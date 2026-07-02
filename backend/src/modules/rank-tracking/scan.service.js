const { Op, literal } = require('sequelize')
const { v4: uuidv4 } = require('uuid')
const GeogridScan = require('../../models/GeogridScan')
const GeogridPoint = require('../../models/GeogridPoint')
const GeogridKeyword = require('../../models/GeogridKeyword')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const { buildGrid } = require('./geogrid.utils')
const provider = require('./providers')
const { ensureAccess, getQuota } = require('./rank-tracking.service')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RANK_PROVIDER_NAME = process.env.RANK_PROVIDER || 'dataforseo'
const NOT_RANKED = 21 // valeur conventionnelle pour ATRP quand la fiche est absente du Top 20
const MAX_COMPETITORS = 5
const DAY_MS = 24 * 60 * 60 * 1000

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function round2(n) { return Math.round(n * 100) / 100 }

async function loadKeyword(keywordId, businessId) {
  if (!UUID_RE.test(keywordId || '')) throw { status: 404, message: 'Mot-clé introuvable' }
  const keyword = await GeogridKeyword.findOne({ where: { id: keywordId, business_id: businessId } })
  if (!keyword) throw { status: 404, message: 'Mot-clé introuvable' }
  if (!keyword.active) throw { status: 400, message: 'Mot-clé désactivé' }
  return keyword
}

// Cœur de création d'un scan, sans contrôle d'accès/quota (assuré par l'appelant) — partagé entre
// l'endpoint manuel (createScan) et le cron (runDueScans). Marque last_scanned_at EN PREMIER pour
// qu'un échec (grille invalide, fournisseur KO) ne relance pas le mot-clé à chaque tick.
async function submitScanForKeyword(keyword) {
  const businessId = keyword.business_id
  await keyword.update({ last_scanned_at: new Date() })

  const location = await Location.findOne({ where: { id: keyword.location_id, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }

  const centerLat = Number(location.lat)
  const centerLng = Number(location.lng)
  const gridPoints = buildGrid(centerLat, centerLng, keyword.grid_size, keyword.grid_spacing_m)
  const pointSpecs = gridPoints.map(p => ({ id: uuidv4(), ...p }))

  const scan = await GeogridScan.create({
    business_id: businessId,
    location_id: location.id,
    keyword_id: keyword.id,
    keyword: keyword.keyword,
    grid_size: keyword.grid_size,
    grid_spacing_m: keyword.grid_spacing_m,
    center_lat: centerLat,
    center_lng: centerLng,
    status: 'pending',
    provider: RANK_PROVIDER_NAME,
    points_total: pointSpecs.length,
    points_ranked: 0,
  })

  const tasks = pointSpecs.map(p => ({ tag: p.id, keyword: keyword.keyword, lat: p.lat, lng: p.lng }))

  let submitted
  try {
    submitted = await provider.submitTasks(tasks)
  } catch (err) {
    await scan.update({ status: 'failed', error_message: err.message })
    throw err
  }

  const byTag = new Map(submitted.map(s => [s.tag, s]))
  let totalCost = 0
  let anySubmitted = false
  const rows = pointSpecs.map(p => {
    const s = byTag.get(p.id)
    if (s?.ok) { totalCost += s.cost || 0; anySubmitted = true }
    return {
      id: p.id,
      scan_id: scan.id,
      business_id: businessId,
      row: p.row,
      col: p.col,
      quadrant: p.quadrant,
      lat: p.lat,
      lng: p.lng,
      provider_task_id: s?.ok ? s.taskId : null,
    }
  })
  await GeogridPoint.bulkCreate(rows)

  await scan.update({
    status: anySubmitted ? 'running' : 'failed',
    credits_used: totalCost,
    error_message: anySubmitted ? null : 'Aucune tâche acceptée par le fournisseur',
  })

  return scan
}

// Endpoint manuel « scanner maintenant » — contrôle d'accès + quota, puis délègue au cœur.
async function createScan(businessId, userId, keywordId) {
  const business = await ensureAccess(businessId, userId)
  const quota = await getQuota(business)
  if (!quota.enabled) throw { status: 403, message: "Le suivi de positionnement n'est pas inclus dans votre plan" }
  const keyword = await loadKeyword(keywordId, businessId)
  return submitScanForKeyword(keyword)
}

// Cœur du rafraîchissement, sans contrôle d'accès. readyTags (Set des tags prêts côté fournisseur)
// peut être pré-calculé par le cron pour éviter un appel tasks_ready par scan ; sinon récupéré ici.
// Idempotent : ne retraite jamais un point déjà résolu (fetched_at non nul).
async function applyRefresh(scan, readyTags) {
  if (scan.status === 'done' || scan.status === 'failed') return scan

  const location = await Location.findByPk(scan.location_id)
  const targetPlaceId = location?.google_place_id

  const pendingPoints = await GeogridPoint.findAll({ where: { scan_id: scan.id, fetched_at: null } })

  if (pendingPoints.length > 0) {
    let tags = readyTags
    if (!tags) {
      const ready = await provider.getReadyTaskIds()
      tags = new Set(ready.map(r => r.tag))
    }
    const toFetch = pendingPoints.filter(pt => pt.provider_task_id && tags.has(pt.id))

    for (const pt of toFetch) {
      const result = await provider.getTaskResult(pt.provider_task_id)
      if (!result) continue

      const targetIdx = result.items.findIndex(it => it.placeId === targetPlaceId)
      const rank = targetIdx >= 0 ? result.items[targetIdx].rank : null
      const competitors = result.items
        .filter(it => it.placeId !== targetPlaceId)
        .slice(0, MAX_COMPETITORS)
        .map(it => ({ place_id: it.placeId, name: it.name, rank: it.rank, rating: it.rating, review_count: it.reviewCount }))

      await pt.update({ rank, competitors, fetched_at: new Date() })

      if (targetIdx >= 0 && scan.rating_snapshot == null) {
        const t = result.items[targetIdx]
        await scan.update({ rating_snapshot: t.rating, review_count_snapshot: t.reviewCount })
      }
    }
  }

  const remaining = await GeogridPoint.count({ where: { scan_id: scan.id, fetched_at: null } })
  const rankedCount = await GeogridPoint.count({ where: { scan_id: scan.id, rank: { [Op.ne]: null } } })

  if (remaining === 0) {
    await finalizeScan(scan)
  } else {
    await scan.update({ points_ranked: rankedCount })
  }

  return GeogridScan.findByPk(scan.id)
}

// Endpoint manuel de rafraîchissement (poll depuis l'UI) — contrôle d'accès puis cœur.
async function refreshScan(scanId, businessId, userId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(scanId)) throw { status: 404, message: 'Scan introuvable' }
  const scan = await GeogridScan.findOne({ where: { id: scanId, business_id: businessId } })
  if (!scan) throw { status: 404, message: 'Scan introuvable' }
  return applyRefresh(scan)
}

async function finalizeScan(scan) {
  const points = await GeogridPoint.findAll({ where: { scan_id: scan.id } })
  const ranked = points.filter(p => p.rank !== null)
  const arp = ranked.length ? round2(avg(ranked.map(p => p.rank))) : null
  const atrp = points.length ? round2(avg(points.map(p => p.rank ?? NOT_RANKED))) : null
  const solv = points.length ? round2((ranked.filter(p => p.rank <= 3).length / points.length) * 100) : 0

  await scan.update({
    status: 'done',
    scanned_at: new Date(),
    points_ranked: ranked.length,
    arp,
    atrp,
    solv,
  })
}

async function listScans(businessId, userId, keywordId) {
  await ensureAccess(businessId, userId)
  const where = { business_id: businessId }
  if (keywordId) where.keyword_id = keywordId
  return GeogridScan.findAll({ where, order: [['created_at', 'DESC']], limit: 50 })
}

async function getScan(scanId, businessId, userId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(scanId)) throw { status: 404, message: 'Scan introuvable' }
  const scan = await GeogridScan.findOne({ where: { id: scanId, business_id: businessId } })
  if (!scan) throw { status: 404, message: 'Scan introuvable' }
  const points = await GeogridPoint.findAll({ where: { scan_id: scan.id }, order: [['row', 'DESC'], ['col', 'ASC']] })
  return { scan, points }
}

// ============ Fonctions cron (G3) — sans contexte utilisateur, appelées par jobs/scan-geogrid.js ============

// Mots-clés actifs « dus » : jamais scannés, ou dernier scan plus vieux que leur fenêtre de fréquence.
// Les jamais-scannés (last_scanned_at NULL) passent en premier.
async function findDueKeywords(limit) {
  const now = Date.now()
  const weeklyCutoff = new Date(now - 7 * DAY_MS)
  const dailyCutoff = new Date(now - DAY_MS)
  return GeogridKeyword.findAll({
    where: {
      active: true,
      [Op.or]: [
        { last_scanned_at: null },
        { frequency: 'weekly', last_scanned_at: { [Op.lte]: weeklyCutoff } },
        { frequency: 'daily', last_scanned_at: { [Op.lte]: dailyCutoff } },
      ],
    },
    order: [[literal('last_scanned_at ASC NULLS FIRST')]],
    limit,
  })
}

// Lance les scans des mots-clés dus, en parallèle par paquets de `concurrency`.
// Ignore un mot-clé dont l'entreprise n'a plus le module au plan (downgrade) sans le relancer.
async function runDueScans(batchSize, concurrency) {
  const candidates = await findDueKeywords(batchSize)
  if (!candidates.length) return { launched: 0, skipped: 0, failed: 0 }

  const eligible = []
  let skipped = 0
  for (const kw of candidates) {
    const business = await Business.findByPk(kw.business_id)
    if (!business) { skipped++; continue }
    const quota = await getQuota(business)
    if (!quota.enabled) { skipped++; continue }
    eligible.push(kw)
  }

  let launched = 0
  let failed = 0
  for (let i = 0; i < eligible.length; i += concurrency) {
    const chunk = eligible.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(kw => submitScanForKeyword(kw)))
    launched += results.filter(r => r.status === 'fulfilled').length
    failed += results.filter(r => r.status === 'rejected').length
  }
  return { launched, skipped, failed }
}

// Rafraîchit tous les scans en cours. Un seul appel tasks_ready pour tout le tick (partagé entre scans).
async function refreshRunningScans(concurrency) {
  const running = await GeogridScan.findAll({ where: { status: 'running' } })
  if (!running.length) return { refreshed: 0, done: 0 }

  const ready = await provider.getReadyTaskIds()
  const readyTags = new Set(ready.map(r => r.tag))

  let done = 0
  for (let i = 0; i < running.length; i += concurrency) {
    const chunk = running.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(scan => applyRefresh(scan, readyTags)))
    done += results.filter(r => r.status === 'fulfilled' && r.value?.status === 'done').length
  }
  return { refreshed: running.length, done }
}

// Bascule en 'failed' les scans coincés (pending/running trop vieux) — garde les points déjà résolus.
async function failStuckScans(timeoutMinutes) {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)
  const [count] = await GeogridScan.update(
    { status: 'failed', error_message: `Timeout : non terminé après ${timeoutMinutes} min` },
    { where: { status: { [Op.in]: ['pending', 'running'] }, createdAt: { [Op.lte]: cutoff } } }
  )
  return { failed: count }
}

module.exports = {
  createScan, refreshScan, listScans, getScan,
  runDueScans, refreshRunningScans, failStuckScans,
}
