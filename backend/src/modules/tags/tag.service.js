const Tag = require('../../models/Tag')
const Business = require('../../models/Business')
const { assertAccess } = require('../businesses/business.service')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function ensureAccess(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

async function create(businessId, userId, { name, color }) {
  await ensureAccess(businessId, userId)
  if (!name || !name.trim()) throw { status: 400, message: 'Nom du tag requis' }
  try {
    return await Tag.create({ business_id: businessId, name: name.trim(), color: color || null })
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw { status: 409, message: 'Ce tag existe déjà' }
    throw err
  }
}

async function list(businessId, userId) {
  await ensureAccess(businessId, userId)
  return Tag.findAll({ where: { business_id: businessId }, order: [['name', 'ASC']] })
}

async function getOne(id, businessId, userId) {
  if (!UUID_RE.test(id)) throw { status: 404, message: 'Tag introuvable' }
  await ensureAccess(businessId, userId)
  const tag = await Tag.findOne({ where: { id, business_id: businessId } })
  if (!tag) throw { status: 404, message: 'Tag introuvable' }
  return tag
}

async function update(id, businessId, userId, { name, color }) {
  const tag = await getOne(id, businessId, userId)
  if (name !== undefined) {
    if (!name.trim()) throw { status: 400, message: 'Nom du tag requis' }
    tag.name = name.trim()
  }
  if (color !== undefined) tag.color = color || null
  try {
    await tag.save()
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw { status: 409, message: 'Ce tag existe déjà' }
    throw err
  }
  return tag
}

async function remove(id, businessId, userId) {
  const tag = await getOne(id, businessId, userId)
  await tag.destroy()
}

module.exports = { create, list, getOne, update, remove }
