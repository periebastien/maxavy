const { Op } = require('sequelize')
const GeogridKeyword = require('../../models/GeogridKeyword')
const GeogridConfig = require('../../models/GeogridConfig')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const Plan = require('../../models/Plan')
const { assertAccess } = require('../businesses/business.service')
const { buildGrid } = require('./geogrid.utils')
const { computeNextRunAt } = require('./schedule.utils')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_GRID_SIZE = 7
const DEFAULT_SPACING_M = 500
const DEFAULT_RUN_HOUR = 4
const DEFAULT_RUN_DAY_OF_WEEK = 1 // lundi

async function ensureAccess(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

async function ensureLocation(locationId, businessId) {
  if (!UUID_RE.test(locationId || '')) throw { status: 404, message: 'Localisation introuvable' }
  const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }
  return location
}

// Quota geogrid du plan de l'entreprise (clé "rank_tracking" de plans.module_quotas).
// Pas de plan / plan sans cette clé / enabled=false → module non disponible.
async function getQuota(business) {
  const plan = business.plan_id ? await Plan.findByPk(business.plan_id) : null
  const quota = plan?.module_quotas?.rank_tracking
  return quota?.enabled ? quota : { enabled: false }
}

async function assertQuotaAvailable(businessId, quota, excludeId) {
  if (!quota.enabled) throw { status: 403, message: "Le suivi de positionnement n'est pas inclus dans votre plan" }
  const where = { business_id: businessId, active: true }
  if (excludeId) where.id = { [Op.ne]: excludeId }
  const used = await GeogridKeyword.count({ where })
  if (used >= quota.max_keywords) {
    throw { status: 403, message: `Limite de ${quota.max_keywords} mot(s)-clé(s) atteinte pour votre plan` }
  }
}

// Défauts d'une config auto-créée (aucune saisie utilisateur encore possible — les endpoints d'édition
// de config arrivent en G7). Lit les nouvelles clés de quota (max_grid_size/allowed_frequencies), avec
// repli sur les anciennes (grid_size/frequency) pour rester robuste pendant la transition — voir §16.
function defaultGridSize(quota) {
  const cap = quota.max_grid_size || quota.grid_size || DEFAULT_GRID_SIZE
  let n = Math.min(DEFAULT_GRID_SIZE, cap)
  if (n % 2 === 0) n -= 1
  return n < 3 ? 3 : n
}

function defaultFrequency(quota) {
  const allowed = quota.allowed_frequencies || (quota.frequency ? [quota.frequency] : ['weekly'])
  return allowed.includes('weekly') ? 'weekly' : allowed[0]
}

// Récupère (ou crée avec des défauts sûrs) la config partagée d'une localisation — 1 par localisation.
// Auto-provisioning : couvre aussi bien une localisation jamais configurée qu'un mot-clé créé avant que
// l'utilisateur n'ait ouvert l'assistant de configuration (G8). Le next_run_at est calculé immédiatement
// pour qu'aucune config active ne reste sans planification (cf. schedule.utils.js).
async function ensureConfigForLocation(location, business) {
  let config = await GeogridConfig.findOne({ where: { location_id: location.id } })
  if (config) return config

  const quota = await getQuota(business)
  const frequency = defaultFrequency(quota)
  const timezone = business.timezone || 'Europe/Paris'

  config = await GeogridConfig.create({
    business_id: business.id,
    location_id: location.id,
    shape: 'square',
    grid_size: defaultGridSize(quota),
    grid_spacing_m: quota.grid_spacing_m || DEFAULT_SPACING_M,
    frequency,
    run_hour: DEFAULT_RUN_HOUR,
    run_day_of_week: frequency === 'weekly' ? DEFAULT_RUN_DAY_OF_WEEK : null,
    run_day_of_month: frequency === 'monthly' ? 1 : null,
    timezone,
    active: true,
  })
  await config.update({ next_run_at: computeNextRunAt(config, timezone) })
  return config
}

async function create(businessId, userId, { location_id, keyword }) {
  const business = await ensureAccess(businessId, userId)
  const location = await ensureLocation(location_id, businessId)
  if (!keyword || !keyword.trim()) throw { status: 400, message: 'Mot-clé requis' }

  const quota = await getQuota(business)
  await assertQuotaAvailable(businessId, quota)
  const config = await ensureConfigForLocation(location, business)

  try {
    return await GeogridKeyword.create({
      business_id: businessId,
      location_id,
      config_id: config.id,
      keyword: keyword.trim(),
      active: true,
    })
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw { status: 409, message: 'Ce mot-clé est déjà suivi sur cette localisation' }
    throw err
  }
}

async function list(businessId, userId, locationId) {
  await ensureAccess(businessId, userId)
  const where = { business_id: businessId }
  if (locationId) where.location_id = locationId
  return GeogridKeyword.findAll({ where, order: [['created_at', 'ASC']] })
}

async function getOne(id, businessId, userId) {
  if (!UUID_RE.test(id)) throw { status: 404, message: 'Mot-clé introuvable' }
  await ensureAccess(businessId, userId)
  const kw = await GeogridKeyword.findOne({ where: { id, business_id: businessId } })
  if (!kw) throw { status: 404, message: 'Mot-clé introuvable' }
  return kw
}

async function update(id, businessId, userId, { keyword, active }) {
  const kw = await getOne(id, businessId, userId)
  const business = await Business.findByPk(businessId)
  const quota = await getQuota(business)

  if (keyword !== undefined) {
    if (!keyword.trim()) throw { status: 400, message: 'Mot-clé requis' }
    kw.keyword = keyword.trim()
  }
  if (active !== undefined) {
    if (active && !kw.active) await assertQuotaAvailable(businessId, quota, kw.id)
    kw.active = active
  }

  try {
    await kw.save()
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw { status: 409, message: 'Ce mot-clé est déjà suivi sur cette localisation' }
    throw err
  }
  return kw
}

async function remove(id, businessId, userId) {
  const kw = await getOne(id, businessId, userId)
  await kw.destroy()
}

async function getQuotaStatus(businessId, userId) {
  const business = await ensureAccess(businessId, userId)
  const quota = await getQuota(business)
  if (!quota.enabled) return { enabled: false, max_keywords: 0, used: 0 }
  const used = await GeogridKeyword.count({ where: { business_id: businessId, active: true } })
  return { ...quota, used }
}

// Aperçu de grille (sans créer de scan ni de config) — accepte un centre et une forme optionnels
// (GEOGRID_REFONTE_FR.md §6 : centre déplaçable + carré/cercle dans le futur wizard, G8). Défaut =
// centré sur la fiche, carré, comme avant l'extension G6.
async function previewGrid(businessId, userId, { location_id, grid_size, grid_spacing_m, shape, center_lat, center_lng }) {
  await ensureAccess(businessId, userId)
  const location = await ensureLocation(location_id, businessId)
  const n = grid_size ? Number(grid_size) : DEFAULT_GRID_SIZE
  const spacing = grid_spacing_m ? Number(grid_spacing_m) : DEFAULT_SPACING_M
  const lat = center_lat != null ? Number(center_lat) : Number(location.lat)
  const lng = center_lng != null ? Number(center_lng) : Number(location.lng)
  const resolvedShape = shape || 'square'
  return {
    center: { lat, lng },
    grid_size: n,
    grid_spacing_m: spacing,
    shape: resolvedShape,
    points: buildGrid(lat, lng, n, spacing, resolvedShape),
  }
}

module.exports = { create, list, getOne, update, remove, getQuotaStatus, previewGrid, getQuota, ensureAccess, ensureConfigForLocation }
