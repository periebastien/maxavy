const Customer = require('../../models/Customer')
const Business = require('../../models/Business')
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

  const customer = await Customer.create({
    business_id:      businessId,
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

async function list(businessId, userId) {
  if (!businessId) throw { status: 400, message: 'business_id requis' }
  await assertBusinessAccess(businessId, userId)
  const customers = await Customer.findAll({
    where: { business_id: businessId },
    order: [['created_at', 'DESC']],
  })
  return customers.map(decryptCustomer)
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

module.exports = { create, list, getOne, update, remove }
