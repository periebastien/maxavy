const { Op, literal } = require('sequelize')
const { v4: uuidv4 } = require('uuid')
const GeogridScan = require('../../models/GeogridScan')
const GeogridPoint = require('../../models/GeogridPoint')
const GeogridKeyword = require('../../models/GeogridKeyword')
const GeogridConfig = require('../../models/GeogridConfig')
const GeogridRun = require('../../models/GeogridRun')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const GeogridCompetitor = require('../../models/GeogridCompetitor')
const { buildGrid } = require('./geogrid.utils')
const { computeNextRunAt } = require('./schedule.utils')
const provider = require('./providers')
const { ensureAccess, getQuota, ensureConfigForLocation } = require('./rank-tracking.service')
const competitorService = require('./competitor.service')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RANK_PROVIDER_NAME = process.env.RANK_PROVIDER || 'dataforseo'
const NOT_RANKED = 21 // valeur conventionnelle pour ATRP quand la fiche est absente du Top 20
// Profondeur DataForSEO déjà récupérée = 20 (depth:20) → passer de 5 à 20 ici est un pur changement de
// stockage, coût data nul (G7 — cf. GEOGRID_REFONTE_FR.md §16). Permet l'agrégation par concurrent.
const MAX_COMPETITORS = 20

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function round2(n) { return Math.round(n * 100) / 100 }

async function loadKeyword(keywordId, businessId) {
  if (!UUID_RE.test(keywordId || '')) throw { status: 404, message: 'Mot-clé introuvable' }
  const keyword = await GeogridKeyword.findOne({ where: { id: keywordId, business_id: businessId } })
  if (!keyword) throw { status: 404, message: 'Mot-clé introuvable' }
  if (!keyword.active) throw { status: 400, message: 'Mot-clé désactivé' }
  return keyword
}

// La grille (taille/espacement/forme) vit désormais sur la config partagée de la localisation, plus sur
// le mot-clé (refonte G5/G6). Auto-provisioning défensif : un mot-clé sans config_id (créé avant le
// cutover, ou orphelin après une config supprimée) se voit rattacher/créer une config à la volée.
async function loadConfigForKeyword(keyword) {
  let config = keyword.config_id ? await GeogridConfig.findByPk(keyword.config_id) : null
  if (!config) {
    const location = await Location.findByPk(keyword.location_id)
    const business = await Business.findByPk(keyword.business_id)
    config = await ensureConfigForLocation(location, business)
    await keyword.update({ config_id: config.id })
  }
  return config
}

// Cœur de création d'un scan, sans contrôle d'accès/quota (assuré par l'appelant) — partagé entre
// l'endpoint manuel (createScan, ad-hoc, runId absent) et le lancement d'un rapport planifié
// (launchRunForConfig, runId présent). Grille/centre viennent de la config du mot-clé, pas du mot-clé
// lui-même (cutover G6 — voir GEOGRID_REFONTE_FR.md §16).
async function submitScanForKeyword(keyword, { runId } = {}) {
  const businessId = keyword.business_id
  const config = await loadConfigForKeyword(keyword)

  const location = await Location.findOne({ where: { id: keyword.location_id, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }

  const centerLat = config.center_lat != null ? Number(config.center_lat) : Number(location.lat)
  const centerLng = config.center_lng != null ? Number(config.center_lng) : Number(location.lng)
  const gridPoints = buildGrid(centerLat, centerLng, config.grid_size, config.grid_spacing_m, config.shape)
  const pointSpecs = gridPoints.map(p => ({ id: uuidv4(), ...p }))

  const scan = await GeogridScan.create({
    business_id: businessId,
    location_id: location.id,
    keyword_id: keyword.id,
    run_id: runId || null,
    keyword: keyword.keyword,
    grid_size: config.grid_size,
    grid_spacing_m: config.grid_spacing_m,
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
    points_top3: ranked.filter(p => p.rank <= 3).length,
    points_top10: ranked.filter(p => p.rank <= 10).length,
    points_top20: ranked.filter(p => p.rank <= 20).length,
  })

  // Agrégats concurrents (G7) : concurrents actifs de la config du mot-clé, au moment du finalize.
  const keyword = await GeogridKeyword.findByPk(scan.keyword_id)
  if (keyword?.config_id) {
    const competitors = await GeogridCompetitor.findAll({ where: { config_id: keyword.config_id, active: true } })
    await competitorService.computeAndStoreForScan(scan, points, competitors)
  }
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

// ============ Fonctions cron (G3, refondues en G6) — sans contexte utilisateur, jobs/scan-geogrid.js ============
// La planification est désormais portée par la config (next_run_at), pas par mot-clé — un "rapport"
// (geogrid_run) scanne TOUS les mots-clés actifs de la config en une fois. Voir GEOGRID_REFONTE_FR.md §7/§16.

// Configs actives dues : next_run_at jamais calculé (NULL, ne devrait plus arriver — filet de sécurité,
// même esprit que last_scanned_at NULL en G3) ou dépassé.
async function findDueConfigs(limit) {
  const now = new Date()
  return GeogridConfig.findAll({
    where: {
      active: true,
      [Op.or]: [{ next_run_at: null }, { next_run_at: { [Op.lte]: now } }],
    },
    order: [[literal('next_run_at ASC NULLS FIRST')]],
    limit,
  })
}

// Cœur du lancement d'un rapport, sans contrôle d'accès/quota ni avancement de planning (assurés par
// l'appelant) — partagé entre le cron (trigger 'scheduled') et l'endpoint manuel (trigger 'manual', qui
// ne touche jamais next_run_at). Scanne tous les mots-clés actifs de la config. Un échec de lancement
// sur UN mot-clé n'empêche pas les autres (Promise.allSettled) et marque has_failures sans faire
// échouer le run entier.
async function launchRun(config, trigger, scheduledFor) {
  const keywords = await GeogridKeyword.findAll({ where: { config_id: config.id, active: true } })
  const run = await GeogridRun.create({
    business_id: config.business_id,
    location_id: config.location_id,
    config_id: config.id,
    trigger,
    status: keywords.length ? 'running' : 'done',
    scheduled_for: scheduledFor || null,
    started_at: new Date(),
    finished_at: keywords.length ? null : new Date(),
    keywords_total: keywords.length,
    keywords_done: 0,
  })
  if (!keywords.length) return run

  const results = await Promise.allSettled(keywords.map(kw => submitScanForKeyword(kw, { runId: run.id })))
  if (results.some(r => r.status === 'rejected')) await run.update({ has_failures: true })
  return run
}

// Lance un rapport (run) pour une config due (appelé par le cron) : avance next_run_at IMMÉDIATEMENT
// (avant tout scan, même principe anti-boucle que last_scanned_at en G3 — un échec ne redéclenche pas
// le run à chaque tick), puis délègue au cœur.
async function launchRunForConfig(config) {
  const business = await Business.findByPk(config.business_id)
  const timezone = config.timezone || business?.timezone || 'Europe/Paris'
  const anchor = config.next_run_at || new Date()
  await config.update({ next_run_at: computeNextRunAt(config, timezone, anchor) })
  return launchRun(config, 'scheduled', anchor)
}

// Endpoint manuel « lancer un rapport maintenant » (G7 — scanne tous les mots-clés actifs de la
// localisation, contrairement à l'ancien createScan qui ne visait qu'un seul mot-clé, toujours exposé
// tel quel pour l'UI actuelle). Ne touche PAS à la planification.
async function createRun(businessId, userId, locationId) {
  const business = await ensureAccess(businessId, userId)
  const quota = await getQuota(business)
  if (!quota.enabled) throw { status: 403, message: "Le suivi de positionnement n'est pas inclus dans votre plan" }
  const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }
  const config = await ensureConfigForLocation(location, business)
  return launchRun(config, 'manual')
}

async function listRuns(businessId, userId, locationId) {
  await ensureAccess(businessId, userId)
  const where = { business_id: businessId }
  if (locationId) where.location_id = locationId
  return GeogridRun.findAll({ where, order: [['created_at', 'DESC']], limit: 50 })
}

async function getRun(runId, businessId, userId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(runId)) throw { status: 404, message: 'Rapport introuvable' }
  const run = await GeogridRun.findOne({ where: { id: runId, business_id: businessId } })
  if (!run) throw { status: 404, message: 'Rapport introuvable' }
  const scans = await GeogridScan.findAll({ where: { run_id: run.id }, order: [['created_at', 'ASC']] })
  return { run, scans }
}

// Série temporelle brute d'un mot-clé (scans terminés, triés par date) — alimente les courbes G9.
// Pas d'agrégation jour/semaine/mois ici : c'est la couche de visualisation (frontend) qui bucketise.
async function getTrend(businessId, userId, keywordId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(keywordId || '')) throw { status: 404, message: 'Mot-clé introuvable' }
  const keyword = await GeogridKeyword.findOne({ where: { id: keywordId, business_id: businessId } })
  if (!keyword) throw { status: 404, message: 'Mot-clé introuvable' }
  return GeogridScan.findAll({
    where: { keyword_id: keywordId, status: 'done' },
    attributes: ['id', 'run_id', 'scanned_at', 'arp', 'atrp', 'solv', 'points_top3', 'points_top10', 'points_top20', 'points_total'],
    order: [['scanned_at', 'ASC']],
  })
}

// Lance les rapports des configs dues, en parallèle par paquets de `concurrency`.
// Ignore une config dont l'entreprise n'a plus le module au plan (downgrade) sans la relancer.
async function runDueConfigs(batchSize, concurrency) {
  const candidates = await findDueConfigs(batchSize)
  if (!candidates.length) return { launched: 0, skipped: 0, failed: 0 }

  const eligible = []
  let skipped = 0
  for (const cfg of candidates) {
    const business = await Business.findByPk(cfg.business_id)
    if (!business) { skipped++; continue }
    const quota = await getQuota(business)
    if (!quota.enabled) { skipped++; continue }
    eligible.push(cfg)
  }

  let launched = 0
  let failed = 0
  for (let i = 0; i < eligible.length; i += concurrency) {
    const chunk = eligible.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(cfg => launchRunForConfig(cfg)))
    launched += results.filter(r => r.status === 'fulfilled').length
    failed += results.filter(r => r.status === 'rejected').length
  }
  return { launched, skipped, failed }
}

// Clôture les runs dont tous les scans sont dans un état terminal (done/failed). has_failures se
// déclenche aussi si moins de scans que de mots-clés visés existent (échec de lancement non rattrapé,
// ex. crash pendant launchRunForConfig) — comportement auto-réparateur, cf. GEOGRID_REFONTE_FR.md §16.
async function closeFinishedRuns() {
  const running = await GeogridRun.findAll({ where: { status: 'running' } })
  let closed = 0
  for (const run of running) {
    const scans = await GeogridScan.findAll({ where: { run_id: run.id }, attributes: ['status'] })
    const unresolved = scans.filter(s => !['done', 'failed'].includes(s.status))
    if (unresolved.length) continue

    const failedCount = scans.filter(s => s.status === 'failed').length
    const hasFailures = run.has_failures || failedCount > 0 || scans.length < run.keywords_total
    await run.update({
      status: 'done',
      has_failures: hasFailures,
      finished_at: new Date(),
      keywords_done: scans.length - failedCount,
    })
    closed++
  }
  return { closed }
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
  createRun, listRuns, getRun, getTrend,
  runDueConfigs, refreshRunningScans, closeFinishedRuns, failStuckScans,
}
