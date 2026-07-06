const { Op } = require('sequelize')
const Business = require('../../models/Business')
const User = require('../../models/User')
const Plan = require('../../models/Plan')
const Location = require('../../models/Location')

// Vue cross-tenant (Super Admin uniquement) — aucun scope owner_id/business_id ici, volontaire.

async function list({ q } = {}) {
  const where = {}
  let ownerIds = null

  if (q && q.trim()) {
    const term = q.trim()
    const matchingOwners = await User.findAll({
      where: { email: { [Op.iLike]: `%${term}%` } },
      attributes: ['id'],
    })
    ownerIds = matchingOwners.map(u => u.id)

    where[Op.or] = [
      { name: { [Op.iLike]: `%${term}%` } },
      ...(ownerIds.length ? [{ owner_id: { [Op.in]: ownerIds } }] : []),
    ]
  }

  const businesses = await Business.findAll({
    where,
    order: [['created_at', 'DESC']],
  })

  if (businesses.length === 0) return []

  const ownerIdSet = [...new Set(businesses.map(b => b.owner_id))]
  const planIdSet = [...new Set(businesses.map(b => b.plan_id).filter(Boolean))]
  const businessIdSet = businesses.map(b => b.id)

  const [owners, plans, locations] = await Promise.all([
    User.findAll({ where: { id: { [Op.in]: ownerIdSet } } }),
    planIdSet.length ? Plan.findAll({ where: { id: { [Op.in]: planIdSet } } }) : [],
    Location.findAll({ where: { business_id: { [Op.in]: businessIdSet } }, attributes: ['id', 'business_id'] }),
  ])

  const ownerById = new Map(owners.map(u => [u.id, u]))
  const planById = new Map(plans.map(p => [p.id, p]))
  const locationCountByBusiness = new Map()
  for (const loc of locations) {
    locationCountByBusiness.set(loc.business_id, (locationCountByBusiness.get(loc.business_id) || 0) + 1)
  }

  return businesses.map(b => {
    const owner = ownerById.get(b.owner_id)
    const plan = b.plan_id ? planById.get(b.plan_id) : null
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      plan: plan ? { id: plan.id, name: plan.name, price: plan.price } : null,
      credit_balance: b.credit_balance,
      owner: owner ? { id: owner.id, email: owner.email, firstname: owner.firstname, lastname: owner.lastname } : null,
      locations_count: locationCountByBusiness.get(b.id) || 0,
      created_at: b.created_at,
    }
  })
}

async function updatePlan(businessId, planId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }

  if (planId != null) {
    const plan = await Plan.findByPk(planId)
    if (!plan) throw { status: 400, message: 'Plan introuvable' }
  }

  business.plan_id = planId ?? null
  await business.save()
  return business
}

module.exports = { list, updatePlan }
