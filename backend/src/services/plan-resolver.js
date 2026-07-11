const User = require('../models/User')
const Plan = require('../models/Plan')

// Résout le plan effectif d'un owner : son plan_id, ou le plan Gratuit en repli si NULL/introuvable.
async function getPlanForOwnerId(ownerId) {
  const user = ownerId ? await User.findByPk(ownerId) : null
  const plan = user?.plan_id ? await Plan.findByPk(user.plan_id) : null
  return plan || Plan.findOne({ where: { name: 'Gratuit' } })
}

// Résout le plan effectif d'un business, via son owner (business.owner_id).
async function getPlanForBusiness(business) {
  return getPlanForOwnerId(business?.owner_id)
}

module.exports = { getPlanForBusiness, getPlanForOwnerId }
