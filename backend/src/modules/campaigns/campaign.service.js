const { Op } = require('sequelize')
const InvitationCampaign = require('../../models/InvitationCampaign')
const Invitation = require('../../models/Invitation')
const Customer = require('../../models/Customer')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const { assertAccess } = require('../businesses/business.service')

async function assertBusiness(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

// intervalMinutes entre chaque invitation selon la cadence choisie
function computeIntervalMinutes({ rate_per_day, rate_per_week }) {
  if (rate_per_day)  return (24 * 60) / rate_per_day
  if (rate_per_week) return (7 * 24 * 60) / rate_per_week
  return 60 // fallback : 1/heure
}

async function create({ businessId, userId, name, channel, locationId, customerIds, filter, ratePer, rateUnit }) {
  const business = await assertBusiness(businessId, userId)

  const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }

  const locationScope = { [Op.or]: [{ location_id: locationId }, { location_id: null }] }

  let customers
  if (filter === 'all') {
    customers = await Customer.findAll({ where: { business_id: businessId, ...locationScope }, attributes: ['id'] })
  } else if (filter === 'uninvited') {
    customers = await Customer.findAll({ where: { business_id: businessId, status: 'pending', ...locationScope }, attributes: ['id'] })
  } else if (customerIds?.length) {
    customers = await Customer.findAll({ where: { id: { [Op.in]: customerIds }, business_id: businessId }, attributes: ['id'] })
  } else {
    throw { status: 400, message: 'Sélectionnez un filtre ou des clients' }
  }
  if (!customers.length) throw { status: 400, message: 'Aucun client valide sélectionné' }

  const rate = { rate_per_day: null, rate_per_week: null }
  if (rateUnit === 'day')  rate.rate_per_day  = ratePer
  if (rateUnit === 'week') rate.rate_per_week = ratePer

  const intervalMin = computeIntervalMinutes(rate)
  const campaignName = name?.trim() || `Campagne du ${new Date().toLocaleDateString('fr-FR')}`

  const campaign = await InvitationCampaign.create({
    business_id:  businessId,
    location_id:  locationId,
    name:         campaignName,
    channel,
    ...rate,
    total_count: customers.length,
    sent_count:  0,
    status:      'running',
  })

  const now = new Date()
  const invitations = customers.map((customer, idx) => ({
    customer_id:  customer.id,
    business_id:  businessId,
    location_id:  locationId,
    campaign_id:  campaign.id,
    channel,
    status:       'pending',
    scheduled_at: new Date(now.getTime() + idx * intervalMin * 60 * 1000),
    created_at:   now,
  }))

  await Invitation.bulkCreate(invitations)

  return campaign
}

async function list(businessId, userId, locationId) {
  await assertBusiness(businessId, userId)
  const where = { business_id: businessId }
  if (locationId) where.location_id = locationId
  return InvitationCampaign.findAll({
    where,
    order: [['created_at', 'DESC']],
  })
}

async function pause(campaignId, businessId, userId) {
  await assertBusiness(businessId, userId)
  const campaign = await InvitationCampaign.findOne({ where: { id: campaignId, business_id: businessId } })
  if (!campaign) throw { status: 404, message: 'Campagne introuvable' }
  if (campaign.status !== 'running') throw { status: 400, message: 'Campagne non active' }
  await campaign.update({ status: 'paused' })
  return campaign
}

async function resume(campaignId, businessId, userId) {
  await assertBusiness(businessId, userId)
  const campaign = await InvitationCampaign.findOne({ where: { id: campaignId, business_id: businessId } })
  if (!campaign) throw { status: 404, message: 'Campagne introuvable' }
  if (campaign.status !== 'paused') throw { status: 400, message: 'Campagne non en pause' }
  await campaign.update({ status: 'running' })
  return campaign
}

async function cancel(campaignId, businessId, userId) {
  await assertBusiness(businessId, userId)
  const campaign = await InvitationCampaign.findOne({ where: { id: campaignId, business_id: businessId } })
  if (!campaign) throw { status: 404, message: 'Campagne introuvable' }
  if (['completed', 'cancelled'].includes(campaign.status)) throw { status: 400, message: 'Campagne déjà terminée' }
  await campaign.update({ status: 'cancelled' })
  await Invitation.update({ status: 'failed' }, {
    where: { campaign_id: campaignId, status: 'pending' },
  })
  return campaign
}

module.exports = { create, list, pause, resume, cancel }
