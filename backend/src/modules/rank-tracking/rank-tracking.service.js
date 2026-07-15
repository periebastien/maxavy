const { Op } = require('sequelize')
const GeogridKeyword = require('../../models/GeogridKeyword')
const GeogridConfig = require('../../models/GeogridConfig')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const User = require('../../models/User')
const { assertAccess } = require('../businesses/business.service')
const { getPlanForBusiness } = require('../../services/plan-resolver')
const { getCost } = require('../../services/credit-costs')
const { buildGrid } = require('./geogrid.utils')
const { computeNextRunAt, isValidTimezone } = require('./schedule.utils')

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
  const plan = await getPlanForBusiness(business)
  const quota = plan?.module_quotas?.rank_tracking
  return quota?.enabled ? quota : { enabled: false }
}

// Quota mots-clés : par LOCALISATION (décision produit, GEOGRID_REFONTE_FR.md §2 décision 4 — chaque
// fiche a son propre compteur, à distinguer du quota "nombre de localisations" du plan lui-même).
async function assertQuotaAvailable(businessId, locationId, quota, excludeId) {
  if (!quota.enabled) throw { status: 403, message: "Le suivi de positionnement n'est pas inclus dans votre plan" }
  const where = { business_id: businessId, location_id: locationId, active: true }
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
  await assertQuotaAvailable(businessId, location_id, quota)
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
    if (active && !kw.active) await assertQuotaAvailable(businessId, kw.location_id, quota, kw.id)
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

// locationId optionnel pour compat ascendante (front pas encore mis à jour partout) : sans lui, le
// compteur reste indicatif au niveau entreprise, mais l'application du quota (assertQuotaAvailable,
// toujours appelée avec un location_id réel à la création) reste, elle, strictement par localisation.
async function getQuotaStatus(businessId, userId, locationId) {
  const business = await ensureAccess(businessId, userId)
  const quota = await getQuota(business)
  if (!quota.enabled) return { enabled: false, max_keywords: 0, used: 0 }
  const where = { business_id: businessId, active: true }
  if (locationId) where.location_id = locationId
  const used = await GeogridKeyword.count({ where })

  // Coût estimé du prochain rapport + solde du pool owner — alimente l'avertissement « crédits
  // insuffisants » côté front (page Configuration). Lecture SEULE de la config (pas
  // ensureConfigForLocation : elle en créerait une active avec next_run_at sur un simple GET, que le
  // cron ramasserait → rapports vides). Pas de config encore → report_cost null, pas d'avertissement.
  let report_cost = null
  let credit_balance = null
  if (locationId) {
    const config = await GeogridConfig.findOne({ where: { location_id: locationId, business_id: businessId } })
    if (config) {
      const costPerPoint = await getCost('geogrid_point')
      report_cost = used * config.grid_size * config.grid_size * costPerPoint
    }
    const owner = await User.findByPk(business.owner_id)
    credit_balance = owner ? Number(owner.credit_balance) : null
  }

  return { ...quota, used, report_cost, credit_balance }
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

async function getConfig(businessId, userId, locationId) {
  const business = await ensureAccess(businessId, userId)
  const location = await ensureLocation(locationId, businessId)
  return ensureConfigForLocation(location, business)
}

// Validation STRICTE (rejette, ne coerce pas silencieusement) — à la différence de previewGrid/l'ancien
// create() de mot-clé : ici l'utilisateur édite explicitement sa configuration (G7, endpoint d'écriture
// exposé pour le futur wizard G8), donc une valeur hors plan doit être signalée, pas juste plafonnée.
function normalizeShape(requested, quota) {
  const allowed = quota.allowed_shapes || ['square']
  const shape = requested || allowed[0] || 'square'
  if (!allowed.includes(shape)) throw { status: 403, message: 'Cette forme de grille n\'est pas incluse dans votre plan' }
  return shape
}

function normalizeGridSizeStrict(requested, quota) {
  const cap = quota.max_grid_size || quota.grid_size || DEFAULT_GRID_SIZE
  const n = Number(requested)
  if (!Number.isInteger(n) || n < 3 || n % 2 === 0) throw { status: 400, message: 'La taille de la grille doit être un nombre impair ≥ 3' }
  if (n > cap) throw { status: 403, message: `Taille de grille maximale pour votre plan : ${cap}` }
  return n
}

function normalizeFrequencyStrict(requested, quota) {
  if (!['monthly', 'weekly', 'daily'].includes(requested)) throw { status: 400, message: 'Fréquence invalide' }
  const allowed = quota.allowed_frequencies || (quota.frequency ? [quota.frequency] : ['weekly'])
  if (!allowed.includes(requested)) throw { status: 403, message: "Cette fréquence n'est pas incluse dans votre plan" }
  return requested
}

async function updateConfig(businessId, userId, locationId, body) {
  const business = await ensureAccess(businessId, userId)
  const location = await ensureLocation(locationId, businessId)
  const config = await ensureConfigForLocation(location, business)
  const quota = await getQuota(business)
  if (!quota.enabled) throw { status: 403, message: "Le suivi de positionnement n'est pas inclus dans votre plan" }

  const {
    shape, grid_size, grid_spacing_m, frequency, run_hour, run_day_of_week, run_day_of_month,
    center_lat, center_lng, timezone, active,
  } = body

  if (shape !== undefined) config.shape = normalizeShape(shape, quota)
  if (grid_size !== undefined) config.grid_size = normalizeGridSizeStrict(grid_size, quota)
  if (grid_spacing_m !== undefined) {
    const n = Number(grid_spacing_m)
    if (!Number.isInteger(n) || n < 50) throw { status: 400, message: 'Espacement invalide (mètres, ≥ 50)' }
    config.grid_spacing_m = n
  }
  if (frequency !== undefined) config.frequency = normalizeFrequencyStrict(frequency, quota)
  if (run_hour !== undefined) {
    const n = Number(run_hour)
    if (!Number.isInteger(n) || n < 0 || n > 23) throw { status: 400, message: 'Heure invalide (0-23)' }
    config.run_hour = n
  }
  if (run_day_of_week !== undefined) {
    const n = run_day_of_week === null ? null : Number(run_day_of_week)
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 6)) throw { status: 400, message: 'Jour de semaine invalide (0-6)' }
    config.run_day_of_week = n
  }
  if (run_day_of_month !== undefined) {
    const n = run_day_of_month === null ? null : Number(run_day_of_month)
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 31)) throw { status: 400, message: 'Jour du mois invalide (1-31)' }
    config.run_day_of_month = n
  }
  if (center_lat !== undefined) {
    if (center_lat !== null && !Number.isFinite(Number(center_lat))) throw { status: 400, message: 'Latitude invalide' }
    config.center_lat = center_lat === null ? null : Number(center_lat)
  }
  if (center_lng !== undefined) {
    if (center_lng !== null && !Number.isFinite(Number(center_lng))) throw { status: 400, message: 'Longitude invalide' }
    config.center_lng = center_lng === null ? null : Number(center_lng)
  }
  if (timezone !== undefined) {
    if (!isValidTimezone(timezone)) throw { status: 400, message: 'Fuseau horaire invalide' }
    config.timezone = timezone
  }
  if (active !== undefined) config.active = !!active

  const resolvedTimezone = config.timezone || business.timezone || 'Europe/Paris'
  config.next_run_at = computeNextRunAt(config, resolvedTimezone)
  await config.save()
  return config
}

module.exports = {
  create, list, getOne, update, remove, getQuotaStatus, previewGrid, getQuota, ensureAccess, ensureConfigForLocation,
  getConfig, updateConfig,
}
