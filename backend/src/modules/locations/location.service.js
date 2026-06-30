const Location = require('../../models/Location')
const Business = require('../../models/Business')
const { assertAccess } = require('../businesses/business.service')

// Vérifie que l'utilisateur a accès au business (propriétaire ou membre d'équipe).
// Garantit l'isolation multi-tenant : on ne touche jamais une location d'un business non accessible.
async function assertBusinessAccess(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Slug unique au sein d'une même entreprise (sert à l'URL publique /avis/[entreprise]/[localisation]).
async function uniqueLocationSlug(businessId, name) {
  const base = slugify(name) || 'localisation'
  let slug = base
  let i = 1
  while (await Location.findOne({ where: { business_id: businessId, slug } })) {
    slug = `${base}-${++i}`
  }
  return slug
}

function validateLatLng(data) {
  if (data.lat != null && (Number(data.lat) < -90 || Number(data.lat) > 90)) {
    throw { status: 400, message: 'Latitude invalide' }
  }
  if (data.lng != null && (Number(data.lng) < -180 || Number(data.lng) > 180)) {
    throw { status: 400, message: 'Longitude invalide' }
  }
}

async function create(data, userId) {
  const { business_id, name, google_place_id } = data
  if (!business_id) throw { status: 400, message: 'business_id requis' }
  await assertBusinessAccess(business_id, userId)

  if (!name || !name.trim()) throw { status: 400, message: 'Le nom de la localisation est requis' }
  if (!google_place_id)      throw { status: 400, message: 'Une fiche Google (google_place_id) est requise' }
  validateLatLng(data)

  const slug = await uniqueLocationSlug(business_id, name)

  return Location.create({
    business_id,
    name:              name.trim(),
    slug,
    address:           data.address           || null,
    lat:               data.lat               ?? null,
    lng:               data.lng               ?? null,
    google_place_id,
    google_place_name: data.google_place_name || null,
    website_url:       data.website_url       || null,
  })
}

async function listForBusiness(businessId, userId) {
  if (!businessId) throw { status: 400, message: 'business_id requis' }
  await assertBusinessAccess(businessId, userId)
  return Location.findAll({ where: { business_id: businessId }, order: [['created_at', 'ASC']] })
}

async function getOne(id, userId) {
  const location = await Location.findByPk(id)
  if (!location) throw { status: 404, message: 'Localisation introuvable' }
  await assertBusinessAccess(location.business_id, userId)
  return location
}

async function update(id, data, userId) {
  const location = await Location.findByPk(id)
  if (!location) throw { status: 404, message: 'Localisation introuvable' }
  await assertBusinessAccess(location.business_id, userId)

  const allowed = ['name', 'address', 'lat', 'lng', 'google_place_id', 'google_place_name', 'website_url']
  const changes = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)))

  if ('name' in changes && (!changes.name || !changes.name.trim())) {
    throw { status: 400, message: 'Le nom ne peut pas être vide' }
  }
  if ('google_place_id' in changes && !changes.google_place_id) {
    throw { status: 400, message: 'google_place_id ne peut pas être vidé' }
  }
  if ('name' in changes) changes.name = changes.name.trim()
  validateLatLng(changes)

  await location.update(changes)
  return location
}

async function remove(id, userId) {
  const location = await Location.findByPk(id)
  if (!location) throw { status: 404, message: 'Localisation introuvable' }
  await assertBusinessAccess(location.business_id, userId)
  await location.destroy()
}

module.exports = { create, listForBusiness, getOne, update, remove }
