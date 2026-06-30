const { Op } = require('sequelize')
const Business = require('../../models/Business')
const TeamMember = require('../../models/TeamMember')
const Location = require('../../models/Location')

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(name) {
  const base = slugify(name)
  let slug = base
  let i = 1
  while (await Business.findOne({ where: { slug } })) {
    slug = `${base}-${++i}`
  }
  return slug
}

async function create({ name, website_url, country, timezone }, userId) {
  const slug = await uniqueSlug(name)
  const business = await Business.create({
    name, slug,
    website_url: website_url || null,
    country:     country     || 'FR',
    timezone:    timezone    || 'Europe/Paris',
    owner_id:    userId,
  })
  return business
}

async function listForUser(userId) {
  const owned = await Business.findAll({ where: { owner_id: userId } })

  const memberships = await TeamMember.findAll({ where: { user_id: userId } })
  const memberIds = memberships.map(m => m.business_id)

  const memberBusinesses = memberIds.length
    ? await Business.findAll({ where: { id: { [Op.in]: memberIds }, owner_id: { [Op.ne]: userId } } })
    : []

  return [...owned, ...memberBusinesses]
}

async function getOne(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

async function update(businessId, data, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  if (business.owner_id !== userId) throw { status: 403, message: 'Seul le propriétaire peut modifier' }

  const allowed = ['name', 'website_url', 'country', 'timezone', 'feedback_page_config']
  const changes = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)))
  await business.update(changes)
  return business
}

async function assertAccess(business, userId) {
  if (business.owner_id === userId) return
  const member = await TeamMember.findOne({ where: { business_id: business.id, user_id: userId } })
  if (!member) throw { status: 403, message: 'Accès refusé' }
}

async function remove(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  if (business.owner_id !== userId) throw { status: 403, message: 'Seul le propriétaire peut supprimer' }
  await Location.destroy({ where: { business_id: businessId } })
  await business.destroy()
}

module.exports = { create, listForUser, getOne, update, remove, assertAccess }
