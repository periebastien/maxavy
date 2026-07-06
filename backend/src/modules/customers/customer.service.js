const { Op } = require('sequelize')
const Customer = require('../../models/Customer')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const Invitation = require('../../models/Invitation')
const { assertAccess } = require('../businesses/business.service')
const { encrypt, decrypt } = require('../../config/encryption')

async function assertBusinessAccess(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

function decryptCustomer(customer) {
  const plain = customer.toJSON()
  plain.email = decrypt(plain.email)
  plain.phone = decrypt(plain.phone)
  return plain
}

async function create(data, businessId, userId) {
  if (!businessId) throw { status: 400, message: 'business_id requis' }
  await assertBusinessAccess(businessId, userId)

  let locationId = data.location_id || null
  if (locationId) {
    const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
    if (!location) throw { status: 404, message: 'Localisation introuvable' }
  }

  const customer = await Customer.create({
    business_id:      businessId,
    location_id:      locationId,
    firstname:        data.firstname || null,
    lastname:         data.lastname  || null,
    email:            encrypt(data.email),
    phone:            encrypt(data.phone),
    consent_given:    data.consent_given    ?? false,
    consent_given_at: data.consent_given    ? new Date() : null,
    consent_given_by: data.consent_given    ? userId : null,
  })
  return decryptCustomer(customer)
}

function locationFilter(locationId) {
  if (!locationId) return {}
  return { [Op.or]: [{ location_id: locationId }, { location_id: null }] }
}

async function list(businessId, userId, locationId) {
  if (!businessId) throw { status: 400, message: 'business_id requis' }
  await assertBusinessAccess(businessId, userId)
  const [customers, invitations] = await Promise.all([
    Customer.findAll({ where: { business_id: businessId, ...locationFilter(locationId) }, order: [['created_at', 'DESC']] }),
    Invitation.findAll({ where: { business_id: businessId, status: 'sent' }, order: [['sent_at', 'ASC']] }),
  ])

  const invsByCustomer = {}
  for (const inv of invitations) {
    if (!invsByCustomer[inv.customer_id]) invsByCustomer[inv.customer_id] = []
    invsByCustomer[inv.customer_id].push({ channel: inv.channel, sent_at: inv.sent_at })
  }

  return customers.map(c => {
    const plain = decryptCustomer(c)
    plain.invitations = invsByCustomer[c.id] || []
    return plain
  })
}

async function getOne(id, userId) {
  const customer = await Customer.findByPk(id)
  if (!customer) throw { status: 404, message: 'Client introuvable' }
  await assertBusinessAccess(customer.business_id, userId)
  return decryptCustomer(customer)
}

async function update(id, data, userId) {
  const customer = await Customer.findByPk(id)
  if (!customer) throw { status: 404, message: 'Client introuvable' }
  await assertBusinessAccess(customer.business_id, userId)

  const allowed = ['firstname', 'lastname', 'email', 'phone', 'consent_given', 'status']
  const changes = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)))

  if ('email' in changes) changes.email = encrypt(changes.email)
  if ('phone' in changes) changes.phone = encrypt(changes.phone)
  if (changes.consent_given && !customer.consent_given) {
    changes.consent_given_at = new Date()
    changes.consent_given_by = userId
  }

  await customer.update(changes)
  return decryptCustomer(customer)
}

async function remove(id, userId) {
  const customer = await Customer.findByPk(id)
  if (!customer) throw { status: 404, message: 'Client introuvable' }
  await assertBusinessAccess(customer.business_id, userId)
  await customer.destroy()
}

async function stats(businessId, userId, locationId) {
  await assertBusinessAccess(businessId, userId)
  const base = { business_id: businessId, ...locationFilter(locationId) }
  const [total, uninvited, invited, reviewed] = await Promise.all([
    Customer.count({ where: base }),
    Customer.count({ where: { ...base, status: 'pending' } }),
    Customer.count({ where: { ...base, status: 'invited' } }),
    Customer.count({ where: { ...base, status: 'reviewed' } }),
  ])
  return { total, uninvited, invited, reviewed }
}

async function search(businessId, userId, q, limit = 50) {
  await assertBusinessAccess(businessId, userId)
  const all = await Customer.findAll({
    where: { business_id: businessId },
    order: [['created_at', 'DESC']],
  })
  const qLower = (q || '').toLowerCase().trim()
  const matches = []
  for (const c of all) {
    if (matches.length >= limit) break
    const email = decrypt(c.email) || ''
    const name = [c.firstname, c.lastname].filter(Boolean).join(' ').toLowerCase()
    if (!qLower || name.includes(qLower) || email.toLowerCase().includes(qLower)) {
      const plain = c.toJSON()
      plain.email = email
      plain.phone = decrypt(c.phone)
      matches.push(plain)
    }
  }
  return matches
}

module.exports = { create, list, getOne, update, remove, stats, search }
