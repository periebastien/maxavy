// Concurrents suivis par configuration + agrégats par scan (position moyenne, top 3/10/20) —
// GEOGRID_REFONTE_FR.md §9, §16. Coût data nul : les concurrents sont déjà présents dans les résultats
// récupérés par point (geogrid_points.competitors, profondeur MAX_COMPETITORS — voir scan.service.js).

const { Op } = require('sequelize')
const GeogridCompetitor = require('../../models/GeogridCompetitor')
const GeogridScanCompetitor = require('../../models/GeogridScanCompetitor')
const GeogridScan = require('../../models/GeogridScan')
const GeogridPoint = require('../../models/GeogridPoint')
const GeogridKeyword = require('../../models/GeogridKeyword')
const GeogridConfig = require('../../models/GeogridConfig')
const { ensureAccess, getQuota } = require('./rank-tracking.service')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_RANKED = 21 // même convention que l'ATRP de la fiche (scan.service.js) — hors profondeur mesurée

function round2(n) { return Math.round(n * 100) / 100 }

async function ensureConfig(configId, businessId) {
  if (!UUID_RE.test(configId || '')) throw { status: 404, message: 'Configuration introuvable' }
  const config = await GeogridConfig.findOne({ where: { id: configId, business_id: businessId } })
  if (!config) throw { status: 404, message: 'Configuration introuvable' }
  return config
}

async function assertCompetitorQuota(configId, quota, excludeId) {
  if (!quota.enabled) throw { status: 403, message: "Le suivi de positionnement n'est pas inclus dans votre plan" }
  const max = quota.max_competitors ?? 0
  const where = { config_id: configId, active: true }
  if (excludeId) where.id = { [Op.ne]: excludeId }
  const used = await GeogridCompetitor.count({ where })
  if (used >= max) throw { status: 403, message: `Limite de ${max} concurrent(s) atteinte pour votre plan` }
}

async function list(businessId, userId, configId) {
  await ensureAccess(businessId, userId)
  const config = await ensureConfig(configId, businessId)
  return GeogridCompetitor.findAll({ where: { config_id: config.id }, order: [['created_at', 'ASC']] })
}

async function create(businessId, userId, { config_id, place_id, name }) {
  const business = await ensureAccess(businessId, userId)
  const config = await ensureConfig(config_id, businessId)
  if (!place_id || !place_id.trim()) throw { status: 400, message: 'Fiche Google requise' }

  const quota = await getQuota(business)
  await assertCompetitorQuota(config.id, quota)

  try {
    return await GeogridCompetitor.create({
      business_id: businessId,
      config_id: config.id,
      place_id: place_id.trim(),
      name: (name || '').trim() || null,
      active: true,
    })
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw { status: 409, message: 'Ce concurrent est déjà suivi sur cette configuration' }
    throw err
  }
}

async function remove(id, businessId, userId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(id)) throw { status: 404, message: 'Concurrent introuvable' }
  const comp = await GeogridCompetitor.findOne({ where: { id, business_id: businessId } })
  if (!comp) throw { status: 404, message: 'Concurrent introuvable' }
  await comp.destroy()
}

// Agrège un concurrent sur les points déjà chargés d'un scan. rank imputé à NOT_RANKED (21) partout où
// son place_id est absent du JSONB competitors du point — « hors profondeur mesurée », pas position
// réelle : ne reflète que les MAX_COMPETITORS meilleurs résultats stockés par point (voir scan.service.js).
function aggregateCompetitorOnPoints(points, placeId) {
  let sum = 0
  let top3 = 0
  let top10 = 0
  let top20 = 0
  let appearances = 0
  for (const pt of points) {
    const found = (pt.competitors || []).find(c => c.place_id === placeId)
    const rank = found ? found.rank : NOT_RANKED
    sum += rank
    if (found) {
      appearances++
      if (rank <= 3) top3++
      if (rank <= 10) top10++
      if (rank <= 20) top20++
    }
  }
  return {
    avg_position: points.length ? round2(sum / points.length) : null,
    points_top3: top3,
    points_top10: top10,
    points_top20: top20,
    appearances,
  }
}

// Calcule et stocke les agrégats des concurrents fournis pour un scan donné. Idempotent : purge d'abord
// les lignes existantes de ces concurrents pour ce scan (delete-then-insert, pas d'upsert Sequelize sur
// contrainte composite). Appelé automatiquement par finalizeScan (concurrents actifs de la config) et
// par recompute() (analyse rétroactive après ajout d'un concurrent).
async function computeAndStoreForScan(scan, points, competitors) {
  if (!competitors.length) return
  const placeIds = competitors.map(c => c.place_id)
  await GeogridScanCompetitor.destroy({ where: { scan_id: scan.id, place_id: { [Op.in]: placeIds } } })
  const rows = competitors.map(c => ({
    scan_id: scan.id,
    business_id: scan.business_id,
    place_id: c.place_id,
    name: c.name,
    ...aggregateCompetitorOnPoints(points, c.place_id),
  }))
  await GeogridScanCompetitor.bulkCreate(rows)
}

// Recalcule les agrégats de tous les concurrents actifs d'une config, sur tous ses scans déjà terminés —
// utile après l'ajout d'un concurrent (§16 : analyse rétroactive). N'apporte de précision complète que
// pour les scans dont les points ont été récupérés avec la profondeur élargie (post-G7) ; les scans plus
// anciens (5 résultats/point) restent partiels — comparaison bornée à la profondeur mesurée à l'époque.
async function recompute(businessId, userId, configId) {
  await ensureAccess(businessId, userId)
  const config = await ensureConfig(configId, businessId)
  const competitors = await GeogridCompetitor.findAll({ where: { config_id: config.id, active: true } })
  if (!competitors.length) return { scans_updated: 0 }

  const keywords = await GeogridKeyword.findAll({ where: { config_id: config.id } })
  const keywordIds = keywords.map(k => k.id)
  if (!keywordIds.length) return { scans_updated: 0 }

  const scans = await GeogridScan.findAll({ where: { keyword_id: { [Op.in]: keywordIds }, status: 'done' } })
  for (const scan of scans) {
    const points = await GeogridPoint.findAll({ where: { scan_id: scan.id } })
    await computeAndStoreForScan(scan, points, competitors)

    // Backfill opportuniste : les scans antérieurs à G7 n'ont jamais eu points_top3/10/20 calculés
    // (colonnes ajoutées en G5, remplies seulement à partir du finalizeScan réécrit en G7). On les
    // rattrape ici puisque les points sont déjà chargés — évite un null permanent pour l'historique.
    if (scan.points_top3 == null) {
      const ranked = points.filter(p => p.rank !== null)
      await scan.update({
        points_top3: ranked.filter(p => p.rank <= 3).length,
        points_top10: ranked.filter(p => p.rank <= 10).length,
        points_top20: ranked.filter(p => p.rank <= 20).length,
      })
    }
  }
  return { scans_updated: scans.length }
}

module.exports = { list, create, remove, recompute, computeAndStoreForScan }
