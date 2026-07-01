const Business = require('../models/Business')

async function checkCredits(req, res, next) {
  const businessId = req.query.business_id || req.body?.business_id
  if (!businessId) return res.status(400).json({ message: 'business_id manquant' })

  const business = await Business.findByPk(businessId)
  if (!business) return res.status(404).json({ message: 'Entreprise introuvable' })
  if (business.credit_balance <= 0) {
    return res.status(402).json({ message: 'Crédits insuffisants' })
  }

  req.business = business
  next()
}

module.exports = { checkCredits }
