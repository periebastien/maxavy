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
const GeogridScanCompetitor = require('../../models/GeogridScanCompetitor')
const { buildGrid } = require('./geogrid.utils')
const { computeNextRunAt, computeNextRunAtSkipping } = require('./schedule.utils')
const { computeBackoffMs } = require('./retry.utils')
const rtConfig = require('./rank-tracking.config') // nommé rtConfig : `cfg` est déjà une variable de boucle dans runDueConfigs
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

// ============ Circuit-breaker (résilience — GEOGRID_REFONTE_FR.md §7) ============
// Compteur d'échecs TRANSPORT consécutifs, en mémoire (se réinitialise au redémarrage → fail-open, ce qui
// est le bon défaut : on ne reste pas bloqué par un état stale). Quand DataForSEO tombe globalement, on
// évite de continuer à lui envoyer des tâches (et des reprises) en rafale — la reco officielle est une
// pause de quelques minutes sur erreurs en série. Un succès remet le compteur à zéro.
let consecutiveTransportFailures = 0
let circuitOpenUntil = null

function recordTransportOutcome(failed) {
  if (failed) {
    consecutiveTransportFailures++
    if (consecutiveTransportFailures >= rtConfig.breakerThreshold) {
      circuitOpenUntil = new Date(Date.now() + rtConfig.breakerCooldownMinutes * 60 * 1000)
    }
  } else {
    consecutiveTransportFailures = 0
    circuitOpenUntil = null
  }
}

function isCircuitOpen() {
  if (!circuitOpenUntil) return false
  if (new Date() >= circuitOpenUntil) { circuitOpenUntil = null; consecutiveTransportFailures = 0; return false }
  return true
}

// Points « en vol » = tâches postées (payées) pas encore résolues. Plafonner ce total protège la file
// tasks_ready de DataForSEO (bornée à 1000) : au-delà, on cesse de LANCER du nouveau travail ce tick, le
// temps que l'existant draine — le poll et la clôture continuent, eux, normalement.
async function pointsInFlight() {
  return GeogridPoint.count({ where: { provider_task_id: { [Op.ne]: null }, fetched_at: null } })
}

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

  // Points créés AVANT la soumission (provider_task_id null) : une reprise (postScanTasks) dispose ainsi
  // de la grille même si le POST échoue en transport — cf. Level A, GEOGRID_REFONTE_FR.md §7.
  await GeogridPoint.bulkCreate(pointSpecs.map(p => ({
    id: p.id, scan_id: scan.id, business_id: businessId,
    row: p.row, col: p.col, quadrant: p.quadrant, lat: p.lat, lng: p.lng, provider_task_id: null,
  })))

  return postScanTasks(scan)
}

// Primitive partagée (soumission initiale ET reprises). Ne LÈVE JAMAIS : un échec transport programme une
// reprise (Level A), un échec métier marque le scan en échec définitif. Anti-double-facturation stricte :
// ne re-POSTe QUE les points sans task, et tente d'abord d'ADOPTER une tâche déjà créée (crash-pendant-POST)
// via tasks_ready (best-effort — ne voit que les tâches terminées). Une tâche déjà payée n'est jamais re-postée.
async function postScanTasks(scan, { adopt = false, readyMap = null } = {}) {
  const points = await GeogridPoint.findAll({ where: { scan_id: scan.id } })

  let noTask = points.filter(p => !p.provider_task_id)
  // Adoption (REPRISES uniquement, adopt=true) : récupère d'éventuelles tâches déjà créées pour des points
  // « sans task » avant de re-POSTer — garde anti-double-facturation sur un crash-pendant-POST. Inutile à la
  // 1ʳᵉ soumission (points fraîchement créés, aucune tâche possible). `readyMap` est fourni par l'appelant
  // (UN seul tasks_ready pour tout le lot → limite serrée 60/min) ; repli sur un fetch local sinon.
  if (adopt && noTask.length) {
    let ready = readyMap
    if (!ready) {
      try { ready = new Map((await provider.getReadyTaskIds()).map(r => [r.tag, r.taskId])) } catch { ready = new Map() }
    }
    for (const p of noTask) {
      const tid = ready.get(p.id)
      if (tid) await p.update({ provider_task_id: tid })
    }
    noTask = points.filter(p => !p.provider_task_id)
  }

  if (!noTask.length) {
    // Tout est déjà posté/adopté → le poll finalisera. (Cas rare : reprise après adoption complète.)
    await scan.update({ status: 'running', next_attempt_at: null, retry_reason: null, error_message: null })
    return GeogridScan.findByPk(scan.id)
  }

  const tasks = noTask.map(p => ({ tag: p.id, keyword: scan.keyword, lat: Number(p.lat), lng: Number(p.lng) }))
  let submitted
  try {
    submitted = await provider.submitTasks(tasks)
    recordTransportOutcome(false)
  } catch (err) {
    if (err.transient) {
      recordTransportOutcome(true)
      return scheduleScanRetry(scan, 'transport', err.message)
    }
    // Erreur métier (ex. champ invalide) : rejouer ne changerait rien → échec définitif.
    await scan.update({ status: 'failed', error_message: err.message, next_attempt_at: null, retry_reason: null })
    return scan
  }

  const byTag = new Map(submitted.map(s => [s.tag, s]))
  let addedCost = 0
  for (const p of noTask) {
    const s = byTag.get(p.id)
    if (s?.ok) { addedCost += s.cost || 0; await p.update({ provider_task_id: s.taskId }) }
  }
  const hasAnyTask = points.some(p => p.provider_task_id)

  await scan.update({
    status: hasAnyTask ? 'running' : 'failed',
    credits_used: round2((Number(scan.credits_used) || 0) + addedCost),
    error_message: hasAnyTask ? null : 'Aucune tâche acceptée par le fournisseur',
    next_attempt_at: null,
    retry_reason: null,
  })
  return GeogridScan.findByPk(scan.id)
}

// Programme la prochaine reprise d'un scan (backoff espacé + jitter déterministe anti-rafale) OU abandonne
// après cfg.maxScanAttempts reprises (échec définitif). reason='transport' → re-submit sûr (0 tâche postée).
async function scheduleScanRetry(scan, reason, errMsg) {
  const attempts = scan.attempts + 1
  if (attempts > rtConfig.maxScanAttempts) {
    await scan.update({ status: 'failed', attempts, next_attempt_at: null, retry_reason: reason, error_message: errMsg })
    return scan
  }
  const delayMs = computeBackoffMs(rtConfig.scanBackoffMinutes, attempts, scan.id, rtConfig.retryJitterMinutes)
  await scan.update({
    status: 'retry_pending',
    attempts,
    next_attempt_at: new Date(Date.now() + delayMs),
    retry_reason: reason,
    error_message: errMsg,
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
  // 'retry_pending' = en attente de re-soumission (Level A), traité par relaunchDueRetryScans, pas ici.
  if (scan.status === 'done' || scan.status === 'failed' || scan.status === 'retry_pending') return scan

  // Récupération (Level B) : des tâches déjà PAYÉES attendent d'être finalisées (retry_reason='partial').
  const recovering = scan.retry_reason === 'partial'

  const location = await Location.findByPk(scan.location_id)
  const targetPlaceId = location?.google_place_id

  const pendingPoints = await GeogridPoint.findAll({ where: { scan_id: scan.id, fetched_at: null } })

  if (pendingPoints.length > 0) {
    let toFetch
    if (recovering) {
      // tasks_ready peut avoir expiré ces tâches (plafond 1000, volatile) → on interroge task_get EN DIRECT
      // par provider_task_id (source fiable, rétention 30 j côté DataForSEO, relecture gratuite).
      toFetch = pendingPoints.filter(pt => pt.provider_task_id)
    } else {
      let tags = readyTags
      if (!tags) {
        const ready = await provider.getReadyTaskIds()
        tags = new Set(ready.map(r => r.tag))
      }
      toFetch = pendingPoints.filter(pt => pt.provider_task_id && tags.has(pt.id))
    }

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
    next_attempt_at: null, // un scan finalisé (y compris récupéré via Level B) n'a plus de reprise en attente
    retry_reason: null,
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

// competitors : agrégats déjà calculés au finalize (G7, GeogridScanCompetitor) — pas de recalcul ici,
// triés par avg_position (les plus proches de la fiche en tête, cohérent avec le tableau triable G9.3).
async function getScan(scanId, businessId, userId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(scanId)) throw { status: 404, message: 'Scan introuvable' }
  const scan = await GeogridScan.findOne({ where: { id: scanId, business_id: businessId } })
  if (!scan) throw { status: 404, message: 'Scan introuvable' }
  const points = await GeogridPoint.findAll({ where: { scan_id: scan.id }, order: [['row', 'DESC'], ['col', 'ASC']] })
  const competitors = await GeogridScanCompetitor.findAll({ where: { scan_id: scan.id }, order: [['avg_position', 'ASC']] })
  return { scan, points, competitors }
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
async function createRunRow(config, trigger, scheduledFor, keywordCount) {
  return GeogridRun.create({
    business_id: config.business_id,
    location_id: config.location_id,
    config_id: config.id,
    trigger,
    status: keywordCount ? 'running' : 'done',
    scheduled_for: scheduledFor || null,
    started_at: new Date(),
    finished_at: keywordCount ? null : new Date(),
    keywords_total: keywordCount,
    keywords_done: 0,
  })
}

// has_failures n'est PLUS posé ici : closeFinishedRuns le calcule d'après le statut FINAL des scans (un
// blip transport devient retry_pending, pas un échec définitif). Promise.allSettled isole les erreurs de
// setup (config/localisation absente) — le mot-clé concerné n'aura pas de scan → détecté à la clôture.
async function submitRunScans(run, keywords) {
  if (!keywords.length) return
  await Promise.allSettled(keywords.map(kw => submitScanForKeyword(kw, { runId: run.id })))
}

async function launchRun(config, trigger, scheduledFor) {
  const keywords = await GeogridKeyword.findAll({ where: { config_id: config.id, active: true } })
  const run = await createRunRow(config, trigger, scheduledFor, keywords.length)
  await submitRunScans(run, keywords)
  return run
}

// Lance un rapport (run) pour une config due (appelé par le cron). Ordre CLÉ (GEOGRID_REFONTE_FR.md §7) :
// on crée le run AVANT d'avancer next_run_at — un crash avant la création laisse next_run_at dans le passé
// → relancé au tick suivant (plus de semaine perdue) ; après, next_run_at est avancé (avec SAUT des périodes
// ratées) → ni run dupliqué ni rafale de rattrapage. Un échec de scan est géré par reprise (retry_pending),
// pas par la re-détection de config due.
async function launchRunForConfig(config) {
  const business = await Business.findByPk(config.business_id)
  const timezone = config.timezone || business?.timezone || 'Europe/Paris'
  const anchor = config.next_run_at || new Date()
  const keywords = await GeogridKeyword.findAll({ where: { config_id: config.id, active: true } })
  const run = await createRunRow(config, 'scheduled', anchor, keywords.length)
  await config.update({ next_run_at: computeNextRunAtSkipping(config, timezone, anchor) })
  await submitRunScans(run, keywords)
  return run
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

// Heatmap « moyenne globale » d'un rapport : pour chaque point de la grille, le rang MOYEN sur tous les
// scans terminés du rapport (rang absent imputé à NOT_RANKED=21, même convention que l'ATRP). Même format
// { center, points } que consomme GeogridMap. Un point dont la moyenne atteint 21 (jamais classé) → rank
// null (affiché « non classé »). Alimente le mode « Moyenne globale » de la page Suivi.
async function getRunAverageMap(runId, businessId, userId) {
  await ensureAccess(businessId, userId)
  if (!UUID_RE.test(runId)) throw { status: 404, message: 'Rapport introuvable' }
  const run = await GeogridRun.findOne({ where: { id: runId, business_id: businessId } })
  if (!run) throw { status: 404, message: 'Rapport introuvable' }

  const scans = await GeogridScan.findAll({
    where: { run_id: run.id, status: 'done' },
    attributes: ['id', 'center_lat', 'center_lng'],
  })
  if (!scans.length) return { center: null, points: [] }

  const points = await GeogridPoint.findAll({
    where: { scan_id: { [Op.in]: scans.map(s => s.id) } },
    attributes: ['row', 'col', 'lat', 'lng', 'rank'],
  })

  const byCell = new Map() // "row:col" -> { row, col, lat, lng, sum, count }
  for (const p of points) {
    const key = `${p.row}:${p.col}`
    let cell = byCell.get(key)
    if (!cell) { cell = { row: p.row, col: p.col, lat: p.lat, lng: p.lng, sum: 0, count: 0 }; byCell.set(key, cell) }
    cell.sum += (p.rank == null ? NOT_RANKED : p.rank)
    cell.count++
  }
  const aggPoints = [...byCell.values()].map(c => {
    const avg = Math.round(c.sum / c.count)
    return { row: c.row, col: c.col, lat: c.lat, lng: c.lng, rank: avg >= NOT_RANKED ? null : avg, competitors: [] }
  })
  const first = scans[0]
  return { center: { lat: Number(first.center_lat), lng: Number(first.center_lng) }, points: aggPoints }
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

// Clôture les runs dont tous les scans sont dans un état terminal (done/failed). Un scan 'retry_pending'
// (reprise en attente) N'EST PAS terminal → le run reste ouvert, pas de clôture ni d'alerte prématurée.
// has_failures se déclenche aussi si moins de scans que de mots-clés visés existent (crash de lancement) —
// auto-réparateur, cf. GEOGRID_REFONTE_FR.md §16.
async function closeFinishedRuns() {
  const running = await GeogridRun.findAll({ where: { status: 'running' } })
  let closed = 0, retried = 0
  for (const run of running) {
    const scans = await GeogridScan.findAll({ where: { run_id: run.id }, attributes: ['status'] })
    const unresolved = scans.filter(s => !['done', 'failed'].includes(s.status))
    if (unresolved.length) continue

    const failedCount = scans.filter(s => s.status === 'failed').length
    const usable = scans.length - failedCount // scans 'done' exploitables
    const hasFailures = run.has_failures || failedCount > 0 || scans.length < run.keywords_total

    // Level C : rapport entièrement inexploitable (aucun scan 'done') et reprises de run non épuisées →
    // replanifier une relance complète (statut retry_pending → ni clôture ni alerte tant que ça peut réussir).
    if (hasFailures && usable === 0 && run.attempts < rtConfig.maxRunAttempts) {
      const delayMs = computeBackoffMs(rtConfig.runBackoffMinutes, run.attempts + 1, run.id, rtConfig.retryJitterMinutes)
      await run.update({ status: 'retry_pending', attempts: run.attempts + 1, next_attempt_at: new Date(Date.now() + delayMs) })
      retried++
      continue
    }

    await run.update({
      status: 'done',
      has_failures: hasFailures,
      finished_at: new Date(),
      keywords_done: usable,
      notify_failure: hasFailures, // hook alerte email (G11) — l'envoi réel consommera puis remettra à false
    })
    closed++
  }
  return { closed, retried }
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

// Traite les scans coincés (pending/running trop vieux). Deux issues, au lieu d'un échec systématique :
// (1) des tâches DÉJÀ PAYÉES attendent encore ET on est dans la fenêtre de récupération → bascule en
// récupération (Level B : re-poll direct au tick), on ne jette pas de données payées ; (2) sinon → échec.
async function failStuckScans(timeoutMinutes) {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)
  const recoveryCutoff = new Date(Date.now() - rtConfig.recoveryWindowMinutes * 60 * 1000)
  const stuck = await GeogridScan.findAll({
    where: { status: { [Op.in]: ['pending', 'running'] }, createdAt: { [Op.lte]: cutoff } },
  })
  let failed = 0, recovering = 0
  for (const scan of stuck) {
    const paidUnresolved = await GeogridPoint.count({
      where: { scan_id: scan.id, provider_task_id: { [Op.ne]: null }, fetched_at: null },
    })
    if (paidUnresolved > 0 && scan.createdAt > recoveryCutoff) {
      if (scan.retry_reason !== 'partial') { await scan.update({ retry_reason: 'partial' }); recovering++ }
    } else {
      await scan.update({ status: 'failed', next_attempt_at: null, error_message: `Timeout : non terminé après ${timeoutMinutes} min` })
      failed++
    }
  }
  return { failed, recovering }
}

// Un scan/run en reprise ne repart que si le suivi est TOUJOURS actif et le module au plan — une fiche
// désactivée ou une entreprise downgradée entre deux essais ne doit plus consommer de crédits.
async function retryStillEligible(businessId, keywordId) {
  const keyword = await GeogridKeyword.findByPk(keywordId)
  if (!keyword || !keyword.active) return false
  const config = keyword.config_id ? await GeogridConfig.findByPk(keyword.config_id) : null
  if (!config || !config.active) return false
  const business = await Business.findByPk(businessId)
  if (!business) return false
  const quota = await getQuota(business)
  return !!quota.enabled
}

// Reprises de scans dues (Level A) : re-soumission EN PLACE via postScanTasks (ne re-POSTe que les points
// sans task → aucune double facturation). Plafonné à batchSize, exécuté par paquets de concurrency.
async function relaunchDueRetryScans(batchSize, concurrency) {
  const now = new Date()
  const due = await GeogridScan.findAll({
    where: { status: 'retry_pending', retry_reason: 'transport', next_attempt_at: { [Op.lte]: now } },
    order: [['next_attempt_at', 'ASC']], limit: batchSize,
  })
  if (!due.length) return { relaunched: 0, cancelled: 0 }

  // UN seul tasks_ready partagé par tout le lot (adoption anti-double-POST) au lieu d'un appel par scan.
  let readyMap = new Map()
  try { readyMap = new Map((await provider.getReadyTaskIds()).map(r => [r.tag, r.taskId])) } catch { readyMap = new Map() }

  let relaunched = 0, cancelled = 0
  for (let i = 0; i < due.length; i += concurrency) {
    const chunk = due.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(async scan => {
      if (!(await retryStillEligible(scan.business_id, scan.keyword_id))) {
        await scan.update({ status: 'failed', next_attempt_at: null, retry_reason: null, error_message: 'Reprise annulée : suivi désactivé' })
        return 'cancelled'
      }
      await postScanTasks(scan, { adopt: true, readyMap })
      return 'relaunched'
    }))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === 'cancelled') cancelled++
      else if (r.status === 'fulfilled') relaunched++
    }
  }
  return { relaunched, cancelled }
}

// Reprises de runs dues (Level C) : relance en place les scans échoués des mots-clés actifs non couverts
// (aucun scan 'done'), remet le run en 'running' (closeFinishedRuns le re-clôturera). Suivi désactivé
// entre-temps → clôture définitive + alerte.
async function relaunchDueRetryRuns(batchSize, concurrency) {
  const now = new Date()
  const due = await GeogridRun.findAll({
    where: { status: 'retry_pending', next_attempt_at: { [Op.lte]: now } },
    order: [['next_attempt_at', 'ASC']], limit: batchSize,
  })
  if (!due.length) return { relaunched: 0, cancelled: 0 }

  // UN seul tasks_ready partagé pour toutes les reprises de ce lot de runs.
  let readyMap = new Map()
  try { readyMap = new Map((await provider.getReadyTaskIds()).map(r => [r.tag, r.taskId])) } catch { readyMap = new Map() }

  let relaunched = 0, cancelled = 0
  for (const run of due) {
    const config = await GeogridConfig.findByPk(run.config_id)
    const business = await Business.findByPk(run.business_id)
    const quota = business ? await getQuota(business) : { enabled: false }
    if (!config || !config.active || !quota.enabled) {
      await run.update({ status: 'done', next_attempt_at: null, finished_at: new Date(), has_failures: true, notify_failure: true })
      cancelled++
      continue
    }
    const doneScans = await GeogridScan.findAll({ where: { run_id: run.id, status: 'done' }, attributes: ['keyword_id'] })
    const doneKwIds = new Set(doneScans.map(s => s.keyword_id))
    const activeKeywords = await GeogridKeyword.findAll({ where: { config_id: config.id, active: true }, attributes: ['id'] })
    const activeKwIds = new Set(activeKeywords.map(k => k.id))
    const failedScans = await GeogridScan.findAll({ where: { run_id: run.id, status: 'failed' } })
    const toRetry = failedScans.filter(s => !doneKwIds.has(s.keyword_id) && activeKwIds.has(s.keyword_id))

    await run.update({ status: 'running', next_attempt_at: null })
    relaunched++
    for (let i = 0; i < toRetry.length; i += concurrency) {
      const chunk = toRetry.slice(i, i + concurrency)
      await Promise.allSettled(chunk.map(scan => postScanTasks(scan, { adopt: true, readyMap })))
    }
  }
  return { relaunched, cancelled }
}

module.exports = {
  createScan, refreshScan, listScans, getScan,
  createRun, listRuns, getRun, getRunAverageMap, getTrend,
  runDueConfigs, refreshRunningScans, closeFinishedRuns, failStuckScans,
  relaunchDueRetryScans, relaunchDueRetryRuns, isCircuitOpen, pointsInFlight,
}
