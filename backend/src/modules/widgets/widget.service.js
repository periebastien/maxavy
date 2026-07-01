const { Op, fn, col } = require('sequelize')
const sequelize = require('../../config/database')
const Widget = require('../../models/Widget')
const Business = require('../../models/Business')
const Review = require('../../models/Review')
const ReviewTag = require('../../models/ReviewTag')
const Location = require('../../models/Location')
const Plan = require('../../models/Plan')
const { assertAccess } = require('../businesses/business.service')
const { mergeDefaults } = require('./widget.defaults')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const APP_URL = () => process.env.APP_URL || 'http://localhost:3000'

const SORT_MAP = {
  recent:  [['published_at', 'DESC']],
  highest: [['rating', 'DESC'], ['published_at', 'DESC']],
  lowest:  [['rating', 'ASC'], ['published_at', 'DESC']],
}

function buildEmbedCode(widgetId) {
  return `<div id="locagain-widget-${widgetId}"></div>\n<script src="${APP_URL()}/api/v1/widgets/${widgetId}/embed.js" async></script>`
}

function googleReviewUrl(placeId) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`
}

async function isFreePlan(business) {
  if (!business || !business.plan_id) return true
  const plan = await Plan.findByPk(business.plan_id)
  if (!plan) return true
  return Number(plan.price) === 0
}

// Cœur partagé getPublic + preview : applique la config (minRating symétrique, tri, limite),
// dérive l'URL Google, force « Propulsé par » en plan gratuit. Ne renvoie que des champs publics.
async function buildPayload({ businessId, locationId, tagId, type, rawConfig }) {
  const config = mergeDefaults(type, rawConfig)

  const where = { business_id: businessId }
  if (locationId) where.location_id = locationId
  if (tagId) {
    const links = await ReviewTag.findAll({ where: { tag_id: tagId } })
    where.id = { [Op.in]: links.map(l => l.review_id) }
  }
  const minRating = config.common.minRating || 0
  if (minRating > 0) where.rating = { [Op.gte]: minRating }

  const count = await Review.count({ where })
  const avgRow = await Review.findOne({ where, attributes: [[fn('AVG', col('rating')), 'avg']], raw: true })
  const average = avgRow && avgRow.avg != null ? Math.round(parseFloat(avgRow.avg) * 10) / 10 : 0

  const order = config.carousel.sort === 'random'
    ? sequelize.random()
    : (SORT_MAP[config.carousel.sort] || SORT_MAP.recent)
  const limit = Math.min(config.carousel.limit || 50, 50)

  const reviews = await Review.findAll({
    where,
    order,
    limit,
    attributes: ['id', 'author_name', 'rating', 'text', 'published_at'],
  })

  let googleUrl = config.common.googleUrl || null
  if (!googleUrl && locationId) {
    const loc = await Location.findByPk(locationId, { attributes: ['google_place_id'] })
    if (loc && loc.google_place_id) googleUrl = googleReviewUrl(loc.google_place_id)
  }

  const business = await Business.findByPk(businessId)
  if (await isFreePlan(business)) config.common.showPoweredBy = true

  return {
    type,
    style: config.style,
    config,
    location_id: locationId || null,
    tag_id: tagId || null,
    googleUrl,
    aggregate: { count, average },
    reviews,
  }
}

async function create(businessId, userId, { name, type = 'carousel', locationId, tagId, config = {} }) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const t = type === 'badge' ? 'badge' : 'carousel'
  const widget = await Widget.create({
    business_id: businessId,
    location_id: locationId || null,
    tag_id: tagId || null,
    name: (name || '').trim() || 'Widget',
    type: t,
    config: mergeDefaults(t, config),
    embed_code: '',
  })

  widget.embed_code = buildEmbedCode(widget.id)
  await widget.save()
  return widget
}

async function list(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  return Widget.findAll({ where: { business_id: businessId }, order: [['created_at', 'DESC']] })
}

async function getOne(id, businessId, userId) {
  if (!UUID_RE.test(id)) throw { status: 404, message: 'Widget introuvable' }
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const widget = await Widget.findOne({ where: { id, business_id: businessId } })
  if (!widget) throw { status: 404, message: 'Widget introuvable' }
  return widget
}

async function update(id, businessId, userId, fields) {
  const widget = await getOne(id, businessId, userId)

  if (fields.name !== undefined) widget.name = String(fields.name).trim() || widget.name
  if (fields.location_id !== undefined) widget.location_id = fields.location_id || null
  if (fields.tag_id !== undefined) widget.tag_id = fields.tag_id || null
  if (fields.config !== undefined) {
    const prev = widget.config || {}
    const incoming = fields.config && typeof fields.config === 'object' ? fields.config : {}
    const merged = {
      style: incoming.style !== undefined ? incoming.style : prev.style,
      common:   { ...(prev.common || {}),   ...(incoming.common || {}) },
      badge:    { ...(prev.badge || {}),    ...(incoming.badge || {}) },
      carousel: { ...(prev.carousel || {}), ...(incoming.carousel || {}) },
    }
    widget.config = mergeDefaults(widget.type, merged)
  }

  await widget.save()
  return widget
}

async function remove(id, businessId, userId) {
  const widget = await getOne(id, businessId, userId)
  await widget.destroy()
}

async function getPublic(id) {
  if (!UUID_RE.test(id)) throw { status: 404, message: 'Widget introuvable' }
  const widget = await Widget.findByPk(id)
  if (!widget) throw { status: 404, message: 'Widget introuvable' }

  const payload = await buildPayload({
    businessId: widget.business_id,
    locationId: widget.location_id,
    tagId: widget.tag_id,
    type: widget.type,
    rawConfig: widget.config,
  })
  return { id: widget.id, updated_at: widget.updated_at, ...payload }
}

// Aperçu builder : rend une config NON persistée. Isolation assurée par le filtre business_id
// dans buildPayload (une location/tag d'une autre entreprise ne remonte aucun avis).
async function preview(businessId, userId, { type, config, locationId, tagId }) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const t = type === 'badge' ? 'badge' : 'carousel'
  const payload = await buildPayload({
    businessId,
    locationId: locationId || null,
    tagId: tagId || null,
    type: t,
    rawConfig: config,
  })
  return { id: null, ...payload }
}

module.exports = { create, list, getOne, update, remove, getPublic, preview }
