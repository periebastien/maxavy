const Business = require('../models/Business')
const TeamMember = require('../models/TeamMember')

async function businessMiddleware(req, res, next) {
  const businessId = req.headers['x-business-id']
  if (!businessId) return res.status(400).json({ message: 'X-Business-Id manquant' })

  const business = await Business.findByPk(businessId)
  if (!business) return res.status(404).json({ message: 'Entreprise introuvable' })

  const isOwner  = business.owner_id === req.user.id
  const isMember = !isOwner && await TeamMember.findOne({ where: { business_id: businessId, user_id: req.user.id } })

  if (!isOwner && !isMember) return res.status(403).json({ message: 'Accès refusé' })

  req.business = business
  next()
}

module.exports = { businessMiddleware }
