const { Op } = require('sequelize')
const GeogridKeyword = require('../../models/GeogridKeyword')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const Plan = require('../../models/Plan')
const { assertAccess } = require('../businesses/business.service')
const { buildGrid } = require('./geogrid.utils')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FREQUENCIES = ['weekly', 'daily']
const DEFAULT_GRID_SIZE = 7
const DEFAULT_SPACING_M = 500

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

function normalizeGridSize(requested, quota) {
  const cap = quota.grid_size || DEFAULT_GRID_SIZE
  let n = Number(requested)
  if (!Number.isInteger(n) || n < 3) n = cap
  if (n % 2 === 0) n -= 1
  return Math.min(n, cap)
}

function normalizeFrequency(requested, quota) {
  const f = requested || quota.frequency || 'weekly'
  if (!FREQUENCIES.includes(f)) throw { status: 400, message: 'Fréquence invalide' }
  if (f === 'daily' && quota.frequency !== 'daily') {
    throw { status: 403, message: "Le suivi quotidien n'est pas inclus dans votre plan" }
  }
  return f
}

async function create(businessId, userId, { location_id, keyword, grid_size, grid_spacing_m, frequency }) {
  const business = await ensureAccess(businessId, userId)
  await ensureLocation(location_id, businessId)
  if (!keyword || !keyword.trim()) throw { status: 400, message: 'Mot-clé requis' }

  const quota = await getQuota(business)
  await assertQuotaAvailable(businessId, quota)

  const resolvedFrequency = normalizeFrequency(frequency, quota)
  const resolvedGridSize = normalizeGridSize(grid_size, quota)
  const resolvedSpacing = Number(grid_spacing_m) > 0 ? Number(grid_spacing_m) : (quota.grid_spacing_m || DEFAULT_SPACING_M)

  try {
    return await GeogridKeyword.create({
      business_id: businessId,
      location_id,
      keyword: keyword.trim(),
      grid_size: resolvedGridSize,
      grid_spacing_m: resolvedSpacing,
      frequency: resolvedFrequency,
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

async function update(id, businessId, userId, { keyword, active, grid_size, grid_spacing_m, frequency }) {
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
  if (frequency !== undefined) kw.frequency = normalizeFrequency(frequency, quota)
  if (grid_size !== undefined) kw.grid_size = normalizeGridSize(grid_size, quota)
  if (grid_spacing_m !== undefined) {
    const n = Number(grid_spacing_m)
    if (!Number.isInteger(n) || n < 50) throw { status: 400, message: 'Espacement invalide (mètres, ≥ 50)' }
    kw.grid_spacing_m = n
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

async function previewGrid(businessId, userId, { location_id, grid_size, grid_spacing_m }) {
  await ensureAccess(businessId, userId)
  const location = await ensureLocation(location_id, businessId)
  const n = grid_size ? Number(grid_size) : DEFAULT_GRID_SIZE
  const spacing = grid_spacing_m ? Number(grid_spacing_m) : DEFAULT_SPACING_M
  return {
    center: { lat: Number(location.lat), lng: Number(location.lng) },
    grid_size: n,
    grid_spacing_m: spacing,
    points: buildGrid(Number(location.lat), Number(location.lng), n, spacing),
  }
}

module.exports = { create, list, getOne, update, remove, getQuotaStatus, previewGrid, getQuota, ensureAccess }
