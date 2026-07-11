const { Op } = require('sequelize')
const Business = require('../../models/Business')
const User = require('../../models/User')
const Plan = require('../../models/Plan')
const Location = require('../../models/Location')

// Vue cross-tenant (Super Admin uniquement) — aucun scope owner_id/business_id ici, volontaire.
// Groupée par owner : plan et crédits vivent désormais sur users, pas sur businesses.

async function list({ q } = {}) {
  const where = {}

  if (q && q.trim()) {
    const term = q.trim()
    const matchingOwners = await User.findAll({
      where: { email: { [Op.iLike]: `%${term}%` } },
      attributes: ['id'],
    })
    const ownerIds = matchingOwners.map(u => u.id)

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
  const businessIdSet = businesses.map(b => b.id)

  const owners = await User.findAll({ where: { id: { [Op.in]: ownerIdSet } } })
  const planIdSet = [...new Set(owners.map(u => u.plan_id).filter(Boolean))]

  const [plans, locations] = await Promise.all([
    planIdSet.length ? Plan.findAll({ where: { id: { [Op.in]: planIdSet } } }) : [],
    Location.findAll({ where: { business_id: { [Op.in]: businessIdSet } }, attributes: ['id', 'business_id', 'name'] }),
  ])

  const planById = new Map(plans.map(p => [p.id, p]))
  const locationsByBusiness = new Map()
  for (const loc of locations) {
    if (!locationsByBusiness.has(loc.business_id)) locationsByBusiness.set(loc.business_id, [])
    locationsByBusiness.get(loc.business_id).push(loc.name)
  }

  const businessesByOwner = new Map()
  for (const b of businesses) {
    if (!businessesByOwner.has(b.owner_id)) businessesByOwner.set(b.owner_id, [])
    businessesByOwner.get(b.owner_id).push(b)
  }

  return owners
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(owner => {
      const plan = owner.plan_id ? planById.get(owner.plan_id) : null
      const ownerBusinesses = businessesByOwner.get(owner.id) || []
      return {
        owner: { id: owner.id, email: owner.email, name: [owner.firstname, owner.lastname].filter(Boolean).join(' ') || null },
        plan: plan ? { id: plan.id, name: plan.name, price: plan.price } : null,
        credit_balance: owner.credit_balance,
        businesses: ownerBusinesses.map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          locations: locationsByBusiness.get(b.id) || [],
          locations_count: (locationsByBusiness.get(b.id) || []).length,
          created_at: b.createdAt,
        })),
      }
    })
}

async function updateOwnerPlan(userId, planId) {
  const user = await User.findByPk(userId)
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' }

  if (planId != null) {
    const plan = await Plan.findByPk(planId)
    if (!plan) throw { status: 400, message: 'Plan introuvable' }
  }

  user.plan_id = planId ?? null
  await user.save()
  return user
}

// Rétrocompatibilité : ancienne route business conservée, redirige maintenant vers le plan de l'owner.
async function updatePlan(businessId, planId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  return updateOwnerPlan(business.owner_id, planId)
}

module.exports = { list, updatePlan, updateOwnerPlan }
