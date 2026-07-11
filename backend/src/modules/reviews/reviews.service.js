const { Op, literal } = require('sequelize')
const sequelize = require('../../config/database')
const Review = require('../../models/Review')
const ReviewSyncJob = require('../../models/ReviewSyncJob')
const Location = require('../../models/Location')
const Tag = require('../../models/Tag')
const ReviewTag = require('../../models/ReviewTag')
const Business = require('../../models/Business')
const Plan = require('../../models/Plan')
const CompetitorReview = require('../../models/CompetitorReview')
const ReviewCompetitorTracking = require('../../models/ReviewCompetitorTracking')
const GeogridConfig = require('../../models/GeogridConfig')
const GeogridCompetitor = require('../../models/GeogridCompetitor')
const User = require('../../models/User')
const { assertAccess } = require('../businesses/business.service')
const { getPlanForBusiness } = require('../../services/plan-resolver')
const provider = require('./providers/dataforseo-reviews.provider')
const config = require('./reviews.config')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROVIDER_NAME = process.env.REVIEWS_PROVIDER || 'dataforseo'

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function round2(n) { return Math.round(n * 100) / 100 }

async function ensureBusinessAccess(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

// ============ Gating par plan (module_quotas.reviews) ============
// Pas de plan / clé absente / enabled=false → synchro non disponible (Gratuit exclu). interval_minutes
// pilote la cadence de synchro automatique par fiche.
async function getReviewsQuota(business) {
  const plan = await getPlanForBusiness(business)
  const quota = plan?.module_quotas?.reviews
  return quota?.enabled ? quota : { enabled: false }
}

// ============ Échelonnement déterministe ============
// Répartit les fiches uniformément sur l'intervalle du plan pour ne JAMAIS envoyer les tâches en rafale
// (consigne « bien échelonner »). Chaque fiche a un décalage stable dérivé de son UUID ; ses créneaux sont
// à { offset, offset+interval, offset+2·interval, ... } en temps absolu → deux fiches ne tombent jamais
// au même instant, et la charge est lissée sur toute la fenêtre.
function hashOffset(id, mod) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  return h % mod
}
function computeNextSyncAt(locationId, intervalMinutes, fromMs) {
  const intervalMs = intervalMinutes * 60 * 1000
  const offset = hashOffset(locationId, intervalMs)
  const k = Math.floor((fromMs - offset) / intervalMs) + 1 // prochain créneau strictement après fromMs
  return new Date(k * intervalMs + offset)
}

// ============ Enqueue d'une synchro (1 tâche DataForSEO par fiche ou par concurrent) ============
// competitorPlaceId=null (défaut) = job "ma fiche" ; sinon garde anti-double-job propre à ce concurrent
// sur cette localisation (un concurrent en cours de synchro ne bloque pas la fiche elle-même, ni les
// autres concurrents — Sequelize traduit `competitor_place_id: null` en `IS NULL`).
async function hasActiveJob(locationId, competitorPlaceId = null) {
  const n = await ReviewSyncJob.count({
    where: { location_id: locationId, competitor_place_id: competitorPlaceId, status: { [Op.in]: ['pending', 'running'] } },
  })
  return n > 0
}

// Business dont le plan inclut la synchro d'avis (module_quotas.reviews.enabled). Factorisé car utilisé
// à la fois pour "ma fiche" (enqueueDueLocations) et pour la réconciliation des concurrents.
async function getEligibleBusinesses() {
  const plans = await Plan.findAll()
  const quotaByPlan = new Map(plans.filter(p => p.module_quotas?.reviews?.enabled).map(p => [p.id, p.module_quotas.reviews]))
  const empty = { businesses: [], quotaByBusiness: new Map() }
  if (!quotaByPlan.size) return empty

  const gratuit = plans.find(p => p.name === 'Gratuit')
  const gratuitQuota = gratuit ? quotaByPlan.get(gratuit.id) : null
  const ownerWhere = gratuitQuota
    ? { [Op.or]: [{ plan_id: { [Op.in]: [...quotaByPlan.keys()] } }, { plan_id: null }] }
    : { plan_id: { [Op.in]: [...quotaByPlan.keys()] } }

  const owners = await User.findAll({ where: ownerWhere })
  if (!owners.length) return empty
  const quotaByOwner = new Map(owners.map(u => [u.id, u.plan_id ? quotaByPlan.get(u.plan_id) : gratuitQuota]))

  const businesses = await Business.findAll({ where: { owner_id: { [Op.in]: owners.map(u => u.id) } } })
  const quotaByBusiness = new Map(businesses.map(b => [b.id, quotaByOwner.get(b.owner_id)]))
  return { businesses, quotaByBusiness }
}

// Crée un job + soumet la tâche. kind = backfill (1er passage, profondeur élevée) tant que la fiche n'a
// jamais été backfillée, sinon incremental (avis récents). Ne touche PAS à la planification de la fiche
// (next_reviews_sync_at) : c'est l'appelant (cron/manuel) qui l'avance, avant l'appel, pour l'anti-boucle.
async function enqueueSyncForLocation(location, business, { depthOverride, priorityOverride } = {}) {
  if (!location.google_place_id) throw { status: 400, message: 'Localisation sans fiche Google (place_id)' }

  const kind = location.reviews_backfilled_at ? 'incremental' : 'backfill'
  const depth = depthOverride || (kind === 'backfill' ? config.backfillDepth : config.syncDepth)

  const job = await ReviewSyncJob.create({
    business_id: business.id,
    location_id: location.id,
    provider: PROVIDER_NAME,
    kind,
    status: 'pending',
    depth,
    sort_by: config.sortBy,
    started_at: new Date(),
  })

  let submitted
  try {
    submitted = await provider.submitTask({
      tag: job.id,
      placeId: location.google_place_id,
      lat: location.lat,
      lng: location.lng,
      depth,
      sortBy: config.sortBy,
      priority: priorityOverride || config.priority,
    })
  } catch (err) {
    await job.update({ status: 'failed', error_message: err.message, finished_at: new Date() })
    throw err
  }

  if (!submitted.ok) {
    await job.update({ status: 'failed', error_message: submitted.statusMessage || 'Tâche refusée par DataForSEO', finished_at: new Date() })
    return job
  }

  await job.update({ status: 'running', provider_task_id: submitted.taskId, cost: submitted.cost })
  return job
}

// ============ Upsert des avis récupérés ============
// Mapping DataForSEO → modèle Review. conflictFields (location_id, platform, external_id) : index unique
// migration 54 (scope par location_id — un même place_id partagé par 2 fiches ne doit jamais faire
// collision, cf. audit sécurité).
async function upsertReviews(job, location, items) {
  let count = 0
  for (const it of items) {
    if (!it.reviewId) continue
    await Review.upsert({
      external_id:  it.reviewId,
      location_id:  location.id,
      business_id:  job.business_id,
      platform:     'google',
      author_name:  it.authorName,
      author_image_url: it.authorImageUrl,
      rating:       it.rating != null ? Math.round(it.rating) : null,
      text:         it.text,
      published_at: it.publishedAt ? new Date(it.publishedAt) : null,
      replied:      !!it.ownerAnswer,
      reply_text:   it.ownerAnswer,
      reply_time:   it.ownerTimestamp ? new Date(it.ownerTimestamp) : null,
    }, { conflictFields: ['location_id', 'platform', 'external_id'] })
    count++
  }
  return count
}

// ============ Suivi des avis de la concurrence (AVIS_CONCURRENTS_FR.md) ============
// Liste de concurrents PARTAGÉE avec le positionnement (geogrid_competitors, via geogrid_configs pour
// résoudre la localisation) — décision produit "pour l'instant" (§2.2/§9). Aucune donnée d'avis n'a de FK
// vers ces tables : un passage à une liste dédiée ne changera que la réconciliation ci-dessous.

// Réconcilie review_competitor_tracking avec l'état actuel de geogrid_competitors, pour les seuls
// business éligibles (module_quotas.reviews.enabled). Appelé à chaque tick, avant l'enqueue :
// - business devenu inéligible (downgrade) → ses lignes de tracking sont supprimées (synchro stoppée,
//   competitor_reviews conservés, §2.8) ;
// - concurrent retiré/désactivé → sa ligne de tracking est supprimée (même conséquence) ;
// - concurrent actif nouvellement suivi → ligne créée avec next_sync_at NULL (dû immédiatement = backfill).
async function reconcileCompetitorTracking() {
  const { businesses } = await getEligibleBusinesses()
  const eligibleBizIds = new Set(businesses.map(b => b.id))

  let removed = 0
  let created = 0

  const staleByBusiness = await ReviewCompetitorTracking.findAll({
    where: eligibleBizIds.size ? { business_id: { [Op.notIn]: [...eligibleBizIds] } } : {},
  })
  for (const t of staleByBusiness) { await t.destroy(); removed++ }

  if (!eligibleBizIds.size) return { created, removed }

  const configs = await GeogridConfig.findAll({ where: { business_id: { [Op.in]: [...eligibleBizIds] } } })
  const configById = new Map(configs.map(c => [c.id, c]))
  const competitors = configs.length
    ? await GeogridCompetitor.findAll({ where: { config_id: { [Op.in]: configs.map(c => c.id) }, active: true } })
    : []

  const shouldTrack = new Map() // "location_id:place_id" -> { business_id, location_id, place_id, name }
  for (const comp of competitors) {
    const cfg = configById.get(comp.config_id)
    if (!cfg) continue
    shouldTrack.set(`${cfg.location_id}:${comp.place_id}`, {
      business_id: cfg.business_id, location_id: cfg.location_id, place_id: comp.place_id, name: comp.name,
    })
  }

  const currentTracking = await ReviewCompetitorTracking.findAll({ where: { business_id: { [Op.in]: [...eligibleBizIds] } } })
  for (const t of currentTracking) {
    const key = `${t.location_id}:${t.place_id}`
    const want = shouldTrack.get(key)
    if (!want) { await t.destroy(); removed++; continue }
    if (want.name && want.name !== t.name) await t.update({ name: want.name })
    shouldTrack.delete(key) // déjà suivi
  }

  for (const want of shouldTrack.values()) {
    await ReviewCompetitorTracking.create(want)
    created++
  }

  return { created, removed }
}

// Soumet une tâche DataForSEO pour l'avis d'UN concurrent (place_id du concurrent, coordonnées de NOTRE
// localisation — même piège location_coordinate que session 21, validé en réel pour ce cas en AC1).
async function enqueueSyncForCompetitor(tracking, location, business, { priorityOverride } = {}) {
  const kind = tracking.backfilled_at ? 'incremental' : 'backfill'
  const depth = kind === 'backfill' ? config.backfillDepth : config.syncDepth

  const job = await ReviewSyncJob.create({
    business_id: business.id,
    location_id: location.id,
    competitor_place_id: tracking.place_id,
    provider: PROVIDER_NAME,
    kind,
    status: 'pending',
    depth,
    sort_by: config.sortBy,
    started_at: new Date(),
  })

  let submitted
  try {
    submitted = await provider.submitTask({
      tag: job.id,
      placeId: tracking.place_id,
      lat: location.lat,
      lng: location.lng,
      depth,
      sortBy: config.sortBy,
      priority: priorityOverride || config.priority,
    })
  } catch (err) {
    await job.update({ status: 'failed', error_message: err.message, finished_at: new Date() })
    throw err
  }

  if (!submitted.ok) {
    await job.update({ status: 'failed', error_message: submitted.statusMessage || 'Tâche refusée par DataForSEO', finished_at: new Date() })
    return job
  }

  await job.update({ status: 'running', provider_task_id: submitted.taskId, cost: submitted.cost })
  return job
}

// Enqueue les concurrents dus (next_sync_at NULL ou dépassé), bornée à batchSize/tick (même étalement
// que enqueueDueLocations). Cadence fixe REVIEWS_COMPETITOR_INTERVAL_MINUTES (indépendante du plan, §2.4).
async function enqueueDueCompetitors(batchSize) {
  const now = new Date()
  const candidates = await ReviewCompetitorTracking.findAll({
    where: { [Op.or]: [{ next_sync_at: null }, { next_sync_at: { [Op.lte]: now } }] },
    order: [[literal('next_sync_at ASC NULLS FIRST')]],
    limit: batchSize * 3,
  })
  if (!candidates.length) return { enqueued: 0, skipped: 0, failed: 0 }

  const locations = await Location.findAll({ where: { id: { [Op.in]: [...new Set(candidates.map(c => c.location_id))] } } })
  const businesses = await Business.findAll({ where: { id: { [Op.in]: [...new Set(candidates.map(c => c.business_id))] } } })
  const locById = new Map(locations.map(l => [l.id, l]))
  const bizById = new Map(businesses.map(b => [b.id, b]))

  let enqueued = 0
  let skipped = 0
  let failed = 0
  for (const tracking of candidates) {
    if (enqueued >= batchSize) break
    if (await hasActiveJob(tracking.location_id, tracking.place_id)) { skipped++; continue }
    const location = locById.get(tracking.location_id)
    const business = bizById.get(tracking.business_id)
    if (!location || !business) { skipped++; continue }

    await tracking.update({ next_sync_at: computeNextSyncAt(tracking.id, config.competitorIntervalMinutes, Date.now()) })
    try {
      await enqueueSyncForCompetitor(tracking, location, business)
      enqueued++
    } catch (err) {
      failed++
      console.error(`[reviews] enqueue concurrent ${tracking.place_id} (location ${tracking.location_id}):`, err.message)
    }
  }
  return { enqueued, skipped, failed }
}

// Upsert des avis d'un concurrent. Mapping identique à upsertReviews, table séparée (competitor_reviews).
async function upsertCompetitorReviews(tracking, businessId, items) {
  let count = 0
  for (const it of items) {
    if (!it.reviewId) continue
    await CompetitorReview.upsert({
      external_id:      it.reviewId,
      location_id:      tracking.location_id,
      business_id:      businessId,
      place_id:         tracking.place_id,
      author_name:      it.authorName,
      author_image_url: it.authorImageUrl,
      rating:           it.rating != null ? Math.round(it.rating) : null,
      text:             it.text,
      published_at:     it.publishedAt ? new Date(it.publishedAt) : null,
    }, { conflictFields: ['location_id', 'place_id', 'external_id'] })
    count++
  }
  return count
}

// ============ Cœurs cron (sans contexte utilisateur) — jobs/sync-reviews.js ============

// Enqueue les fiches dues (next_reviews_sync_at NULL ou dépassé) dont le plan inclut la synchro et qui
// n'ont pas déjà un job actif. Borné à batchSize/tick pour étaler. Avance next_reviews_sync_at AVANT le
// submit (anti-boucle : un submit en échec ne redéclenche pas la fiche à chaque tick).
async function enqueueDueLocations(batchSize) {
  const { businesses, quotaByBusiness } = await getEligibleBusinesses()
  if (!businesses.length) return { enqueued: 0, skipped: 0, failed: 0 }
  const bizById = new Map(businesses.map(b => [b.id, b]))

  const now = new Date()
  const candidates = await Location.findAll({
    where: {
      business_id: { [Op.in]: [...bizById.keys()] },
      [Op.or]: [{ next_reviews_sync_at: null }, { next_reviews_sync_at: { [Op.lte]: now } }],
    },
    order: [[literal('next_reviews_sync_at ASC NULLS FIRST')]],
    limit: batchSize * 3, // marge : certaines écartées (job actif) sans épuiser le lot
  })

  let enqueued = 0
  let skipped = 0
  let failed = 0
  for (const loc of candidates) {
    if (enqueued >= batchSize) break
    if (await hasActiveJob(loc.id)) { skipped++; continue }
    const business = bizById.get(loc.business_id)
    const quota = quotaByBusiness.get(business.id)
    await loc.update({ next_reviews_sync_at: computeNextSyncAt(loc.id, quota.interval_minutes, Date.now()) })
    try {
      await enqueueSyncForLocation(loc, business)
      enqueued++
    } catch (err) {
      failed++
      console.error(`[reviews] enqueue location ${loc.id}:`, err.message)
    }
  }
  return { enqueued, skipped, failed }
}

// Rafraîchit les jobs en cours : un seul appel tasks_ready pour tout le tick (partagé). Sur job terminé,
// upsert des avis + horodatage de la fiche. Garde-fou incrémental « saturé » (tous les avis ramenés sont
// nouveaux ET on a atteint depth) → probablement d'autres avis récents non vus → force un backfill de
// rattrapage au prochain tick. Rare ; converge (le backfill profond ramène tout, puis retour au normal).
async function pollRunningJobs(concurrency) {
  const running = await ReviewSyncJob.findAll({ where: { status: 'running' } })
  if (!running.length) return { polled: 0, done: 0 }

  const ready = await provider.getReadyTaskIds()
  const readyTags = new Set(ready.map(r => r.tag)) // tag = job.id
  const toFetch = running.filter(j => j.provider_task_id && readyTags.has(j.id))

  let done = 0
  for (let i = 0; i < toFetch.length; i += concurrency) {
    const chunk = toFetch.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(resolveJob))
    done += results.filter(r => r.status === 'fulfilled' && r.value).length
  }
  return { polled: running.length, done }
}

// Branche selon competitor_place_id (NULL = ma fiche, non NULL = avis d'un concurrent) — un seul poll
// (tasks_ready) partagé pour les deux flux, comme prévu par AVIS_CONCURRENTS_FR.md §4.3.
async function resolveJob(job) {
  try {
    const result = await provider.getTaskResult(job.provider_task_id)
    if (!result) return false // pas encore prêt (défensif)
    return job.competitor_place_id
      ? await resolveCompetitorJob(job, result)
      : await resolveLocationJob(job, result)
  } catch (err) {
    await job.update({ status: 'failed', error_message: err.message, finished_at: new Date() })
    return false
  }
}

async function resolveLocationJob(job, result) {
  const location = await Location.findByPk(job.location_id)
  if (!location) { await job.update({ status: 'failed', error_message: 'Localisation supprimée', finished_at: new Date() }); return false }

  const upserted = await upsertReviews(job, location, result.items)
  const finishedAt = new Date()
  await job.update({ status: 'done', reviews_found: result.items.length, reviews_upserted: upserted, finished_at: finishedAt })

  const patch = { last_reviews_sync_at: finishedAt, total_reviews_count: result.reviewsCount ?? location.total_reviews_count }
  const ratings = result.items.map(it => it.rating).filter(r => r != null)
  if (ratings.length) patch.avg_rating = round2(avg(ratings)) // snapshot du dernier lot résolu, pas une moyenne glissante
  if (job.kind === 'backfill') patch.reviews_backfilled_at = finishedAt
  // saturation incrémentale → rattrapage profond au prochain tick
  if (job.kind === 'incremental' && result.items.length >= job.depth && upserted >= job.depth) {
    patch.reviews_backfilled_at = null
    patch.next_reviews_sync_at = new Date()
  }
  await location.update(patch)
  return true
}

async function resolveCompetitorJob(job, result) {
  const tracking = await ReviewCompetitorTracking.findOne({ where: { location_id: job.location_id, place_id: job.competitor_place_id } })
  if (!tracking) { await job.update({ status: 'failed', error_message: 'Concurrent retiré du suivi', finished_at: new Date() }); return false }

  const upserted = await upsertCompetitorReviews(tracking, job.business_id, result.items)
  const finishedAt = new Date()
  await job.update({ status: 'done', reviews_found: result.items.length, reviews_upserted: upserted, finished_at: finishedAt })

  const patch = { last_synced_at: finishedAt, total_reviews_count: result.reviewsCount ?? tracking.total_reviews_count }
  const ratings = result.items.map(it => it.rating).filter(r => r != null)
  if (ratings.length) patch.avg_rating = round2(avg(ratings)) // snapshot du dernier lot résolu, pas une moyenne glissante
  if (job.kind === 'backfill') patch.backfilled_at = finishedAt
  if (job.kind === 'incremental' && result.items.length >= job.depth && upserted >= job.depth) {
    patch.backfilled_at = null
    patch.next_sync_at = new Date()
  }
  await tracking.update(patch)
  return true
}

// Jobs coincés (pending/running trop vieux) → failed. Timeout > délai max de la file DataForSEO.
async function failStuckJobs(timeoutMinutes) {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)
  const [count] = await ReviewSyncJob.update(
    { status: 'failed', error_message: `Timeout : non terminé après ${timeoutMinutes} min`, finished_at: new Date() },
    { where: { status: { [Op.in]: ['pending', 'running'] }, created_at: { [Op.lte]: cutoff } } }
  )
  return { failed: count }
}

// ============ Endpoints HTTP ============

// Bouton « Synchroniser maintenant » — enqueue toutes les fiches du business (gaté par plan). Avance aussi
// leur prochaine échéance pour que le cron ne relance pas une synchro immédiatement après.
async function triggerSync(businessId, userId) {
  const business = await ensureBusinessAccess(businessId, userId)
  const quota = await getReviewsQuota(business)
  if (!quota.enabled) throw { status: 403, message: "La synchronisation des avis n'est pas incluse dans votre plan" }

  const locations = await Location.findAll({ where: { business_id: businessId } })
  let queued = 0
  for (const loc of locations) {
    if (await hasActiveJob(loc.id)) continue
    await loc.update({ next_reviews_sync_at: computeNextSyncAt(loc.id, quota.interval_minutes, Date.now()) })
    try {
      // File Priority pour le manuel : l'utilisateur attend le résultat (~1 min vs ~45 min en standard).
      // Le cron, lui, reste en standard (config.priority) — économique car non interactif.
      await enqueueSyncForLocation(loc, business, { priorityOverride: 2 })
      queued++
    } catch (err) {
      console.error(`[reviews] enqueue manuel location ${loc.id}:`, err.message)
    }
  }
  return { queued, locations: locations.length }
}

// État de synchro pour le polling front (après clic « Synchroniser »).
async function getSyncStatus(businessId, userId) {
  await ensureBusinessAccess(businessId, userId)
  const active = await ReviewSyncJob.count({ where: { business_id: businessId, status: { [Op.in]: ['pending', 'running'] } } })
  const locations = await Location.findAll({ where: { business_id: businessId }, attributes: ['last_reviews_sync_at'] })
  const lastSyncedAt = locations.reduce((max, l) => {
    const t = l.last_reviews_sync_at
    return t && (!max || t > max) ? t : max
  }, null)
  return { running: active > 0, active, last_synced_at: lastSyncedAt }
}

// ============ Lecture des avis (inchangé) ============
async function listReviews(businessId, userId, { locationId, page = 1, limit = 20 } = {}) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const where = { business_id: businessId }
  if (locationId) where.location_id = locationId

  const offset = (page - 1) * limit
  const { count, rows } = await Review.findAndCountAll({
    where,
    order: [['published_at', 'DESC']],
    limit,
    offset,
  })

  const reviews = await attachTags(rows)
  return { total: count, page, limit, reviews }
}

async function attachTags(rows) {
  const ids = rows.map(r => r.id)
  if (!ids.length) return rows.map(r => ({ ...r.toJSON(), tags: [] }))

  const links = await ReviewTag.findAll({ where: { review_id: { [Op.in]: ids } } })
  const tagIds = [...new Set(links.map(l => l.tag_id))]
  const tags = tagIds.length ? await Tag.findAll({ where: { id: { [Op.in]: tagIds } } }) : []
  const tagById = Object.fromEntries(tags.map(t => [t.id, t.toJSON()]))

  const byReview = {}
  for (const l of links) {
    if (!tagById[l.tag_id]) continue
    ;(byReview[l.review_id] ||= []).push(tagById[l.tag_id])
  }

  return rows.map(r => ({ ...r.toJSON(), tags: byReview[r.id] || [] }))
}

async function setReviewTags(reviewId, businessId, userId, tagIds = []) {
  if (!UUID_RE.test(reviewId)) throw { status: 404, message: 'Avis introuvable' }

  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId, { write: true })

  const review = await Review.findOne({ where: { id: reviewId, business_id: businessId } })
  if (!review) throw { status: 404, message: 'Avis introuvable' }

  const ids = [...new Set(tagIds)].filter(Boolean)
  if (ids.length) {
    if (!ids.every(id => UUID_RE.test(id))) throw { status: 400, message: 'Tag invalide' }
    const owned = await Tag.findAll({ where: { id: { [Op.in]: ids }, business_id: businessId } })
    if (owned.length !== ids.length) throw { status: 400, message: 'Tag invalide' }
  }

  await ReviewTag.destroy({ where: { review_id: reviewId } })
  if (ids.length) await ReviewTag.bulkCreate(ids.map(tag_id => ({ review_id: reviewId, tag_id })))

  const tags = ids.length ? await Tag.findAll({ where: { id: { [Op.in]: ids } } }) : []
  return tags
}

// ============ Stats "avis de la concurrence" (AVIS_CONCURRENTS_FR.md §5) ============

// Label 'YYYY-MM' à partir des accesseurs UTC (les données sont déjà en UTC via date_trunc côté Postgres,
// cohérent avec yearStart/yearEnd construits via Date.UTC — piège toISOString()/local déjà rencontré en G9.2).
function labelUTC(dt) {
  const d = dt instanceof Date ? dt : new Date(dt)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Construit une série de 12 mois pour une entité (ma fiche ou un concurrent). Ne filtre jamais les mois :
// complete_from n'est qu'une indication pour le frontend (mois <= complete_from potentiellement incomplets).
function buildSeries(key, name, monthlyRows, storedCount, oldestDate, reportedTotal, avgRating, monthLabels, lastSyncedAt) {
  const byMonth = new Map(monthlyRows.map(r => [labelUTC(r.month), r.count]))
  const months = monthLabels.map(m => ({ month: m, count: byMonth.get(m) || 0 }))
  const isFullyBackfilled = reportedTotal != null && storedCount >= reportedTotal
  const complete_from = (isFullyBackfilled || !oldestDate) ? null : labelUTC(oldestDate)
  return {
    key, name, months, complete_from,
    total_reviews_count: reportedTotal ?? storedCount,
    avg_rating: avgRating ?? null,
    last_synced_at: lastSyncedAt ?? null,
  }
}

async function getCompetitorStats(businessId, userId, locationId, rawYear) {
  const business = await ensureBusinessAccess(businessId, userId)
  const quota = await getReviewsQuota(business)
  if (!quota.enabled) throw { status: 403, message: "Le suivi des avis n'est pas inclus dans votre plan" }

  if (!UUID_RE.test(locationId || '')) throw { status: 404, message: 'Localisation introuvable' }
  const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }

  const currentYear = new Date().getFullYear()
  let year = parseInt(rawYear, 10)
  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) year = currentYear

  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1))

  const tracking = await ReviewCompetitorTracking.findAll({ where: { business_id: businessId, location_id: locationId } })
  const placeIds = tracking.map(t => t.place_id)

  // date_trunc('month', ...) tronque dans le fuseau de SESSION Postgres, pas forcément UTC — vérifié en
  // réel (2026-07-03) : la session de cette app est bien UTC (`SHOW timezone` → "<+00>-00"), donc la
  // troncature coïncide avec les frontières de mois UTC utilisées par labelUTC()/yearStart/yearEnd.
  // ⚠️ NE PAS "corriger" avec `published_at AT TIME ZONE 'UTC'` : testé en réel, ça décale le résultat
  // d'un jour (l'opérateur AT TIME ZONE sur un timestamptz déjà en UTC réinterprète la valeur et introduit
  // le bug qu'il est censé éviter).
  const [meMonthlyRows] = await sequelize.query(
    `SELECT date_trunc('month', published_at) AS month, count(*)::int AS count
     FROM reviews
     WHERE business_id = :businessId AND location_id = :locationId
       AND published_at >= :yearStart AND published_at < :yearEnd
     GROUP BY 1 ORDER BY 1`,
    { replacements: { businessId, locationId, yearStart, yearEnd } }
  )

  const [meTotalsRows] = await sequelize.query(
    `SELECT count(*)::int AS stored_count, min(published_at) AS oldest
     FROM reviews WHERE business_id = :businessId AND location_id = :locationId`,
    { replacements: { businessId, locationId } }
  )
  const meTotals = meTotalsRows[0]

  let competitorMonthlyRows = []
  let competitorTotalsRows = []
  if (placeIds.length > 0) {
    ;[competitorMonthlyRows] = await sequelize.query(
      `SELECT place_id, date_trunc('month', published_at) AS month, count(*)::int AS count
       FROM competitor_reviews
       WHERE business_id = :businessId AND location_id = :locationId AND place_id IN (:placeIds)
         AND published_at >= :yearStart AND published_at < :yearEnd
       GROUP BY 1, 2 ORDER BY 2`,
      { replacements: { businessId, locationId, placeIds, yearStart, yearEnd } }
    )
    ;[competitorTotalsRows] = await sequelize.query(
      `SELECT place_id, count(*)::int AS stored_count, min(published_at) AS oldest
       FROM competitor_reviews
       WHERE business_id = :businessId AND location_id = :locationId AND place_id IN (:placeIds)
       GROUP BY place_id`,
      { replacements: { businessId, locationId, placeIds } }
    )
  }

  const monthLabels = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  const meSeries = buildSeries('me', location.name, meMonthlyRows, meTotals.stored_count, meTotals.oldest, location.total_reviews_count, location.avg_rating, monthLabels, location.last_reviews_sync_at)

  const competitorTotalsByPlaceId = new Map(competitorTotalsRows.map(r => [r.place_id, r]))
  const competitorSeries = tracking.map(t => {
    const monthlyRows = competitorMonthlyRows.filter(r => r.place_id === t.place_id)
    const totals = competitorTotalsByPlaceId.get(t.place_id)
    return buildSeries(t.place_id, t.name, monthlyRows, totals ? totals.stored_count : 0, totals ? totals.oldest : null, t.total_reviews_count, t.avg_rating, monthLabels, t.last_synced_at)
  })

  // L'année demandée (`year`) doit TOUJOURS figurer dans available_years, même si elle précède toutes les
  // données existantes (ex. business tout neuf consulté sur une vieille année) — sinon le sélecteur
  // d'année du frontend n'aurait pas l'année couramment affichée dans sa propre liste d'options.
  const oldestDates = [meTotals.oldest, ...competitorTotalsRows.map(r => r.oldest)].filter(Boolean)
  const dataMinYear = oldestDates.length ? Math.min(...oldestDates.map(d => new Date(d).getUTCFullYear())) : year
  const minYear = Math.min(dataMinYear, year)
  const maxYear = Math.max(currentYear, year)
  const available_years = []
  for (let y = maxYear; y >= minYear; y--) available_years.push(y)

  return { year, available_years, series: [meSeries, ...competitorSeries] }
}

// Synchro manuelle immédiate (priority) d'UN concurrent après son ajout depuis la page Avis >
// Concurrents — l'utilisateur attend un résultat rapide (~1 min), contrairement au cron (standard,
// jusqu'à 45 min). Réconcilie d'abord (le concurrent vient peut-être d'être ajouté côté rank-tracking,
// review_competitor_tracking n'a pas encore de ligne pour lui).
async function triggerCompetitorSync(businessId, userId, locationId, placeId) {
  const business = await ensureBusinessAccess(businessId, userId)
  const quota = await getReviewsQuota(business)
  if (!quota.enabled) throw { status: 403, message: "Le suivi des avis n'est pas inclus dans votre plan" }

  if (!UUID_RE.test(locationId || '')) throw { status: 404, message: 'Localisation introuvable' }
  const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }
  if (!placeId) throw { status: 400, message: 'Concurrent requis' }

  await reconcileCompetitorTracking()
  const tracking = await ReviewCompetitorTracking.findOne({ where: { business_id: businessId, location_id: locationId, place_id: placeId } })
  if (!tracking) throw { status: 404, message: 'Concurrent introuvable dans le suivi' }

  if (await hasActiveJob(locationId, placeId)) return { queued: false, reason: 'already_running' }
  await enqueueSyncForCompetitor(tracking, location, business, { priorityOverride: 2 })
  return { queued: true }
}

module.exports = {
  listReviews, setReviewTags, triggerSync, getSyncStatus,
  enqueueDueLocations, pollRunningJobs, failStuckJobs,
  reconcileCompetitorTracking, enqueueDueCompetitors,
  getReviewsQuota, // exporté pour tests/diagnostic
  getCompetitorStats,
  triggerCompetitorSync,
}
