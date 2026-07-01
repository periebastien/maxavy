const { Op } = require('sequelize')
const Credit = require('../../models/Credit')
const Business = require('../../models/Business')
const TeamMember = require('../../models/TeamMember')

async function assertBusiness(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  if (business.owner_id !== userId) {
    const member = await TeamMember.findOne({ where: { business_id: businessId, user_id: userId } })
    if (!member) throw { status: 403, message: 'Accès refusé' }
  }
  return business
}

async function getBalance(businessId, userId) {
  const business = await assertBusiness(businessId, userId)
  const totalEarned = await Credit.sum('amount', {
    where: { business_id: businessId, amount: { [Op.gt]: 0 } },
  }) || 0
  const totalSpent = await Credit.sum('amount', {
    where: { business_id: businessId, amount: { [Op.lt]: 0 } },
  }) || 0
  return {
    balance: business.credit_balance,
    total_earned: totalEarned,
    total_spent: Math.abs(totalSpent),
  }
}

async function getHistory(businessId, userId, { page = 1, limit = 20 } = {}) {
  await assertBusiness(businessId, userId)
  const offset = (page - 1) * limit
  const { count, rows } = await Credit.findAndCountAll({
    where:  { business_id: businessId },
    order:  [['created_at', 'DESC']],
    limit,
    offset,
  })
  return { total: count, page, limit, history: rows }
}

async function addCredits(businessId, userId, { amount, action_type, source = 'bonus' }) {
  const business = await assertBusiness(businessId, userId)
  if (amount <= 0) throw { status: 400, message: 'Montant invalide' }
  await Credit.create({ business_id: businessId, amount, action_type, source })
  await business.increment('credit_balance', { by: amount })
  return Business.findByPk(businessId)
}

// Utilisé à la création d'entreprise (sans vérification d'accès — appelé en interne)
async function grantWelcomeCredits(businessId) {
  const WELCOME = 50
  await Credit.create({
    business_id: businessId,
    amount:      WELCOME,
    action_type: 'welcome',
    source:      'bonus',
  })
  await Business.update(
    { credit_balance: WELCOME },
    { where: { id: businessId } },
  )
}

module.exports = { getBalance, getHistory, addCredits, grantWelcomeCredits }
