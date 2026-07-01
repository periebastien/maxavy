const service = require('./stripe.service')
const Plan = require('../../models/Plan')

async function getPlans(req, res) {
  try {
    const plans = await Plan.findAll({
      where: { active: true },
      order: [['sort_order', 'ASC']],
    })
    res.json(plans)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getPacks(req, res) {
  res.json(service.CREDIT_PACKS)
}

async function subscribeCheckout(req, res) {
  try {
    const result = await service.createSubscriptionCheckout(
      req.query.business_id, req.user.id, req.body
    )
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function creditsCheckout(req, res) {
  try {
    const result = await service.createCreditsCheckout(
      req.query.business_id, req.user.id, req.body
    )
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function webhook(req, res) {
  try {
    const sig = req.headers['stripe-signature']
    const result = await service.handleWebhook(req.body, sig)
    res.json(result)
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message })
  }
}

module.exports = { getPlans, getPacks, subscribeCheckout, creditsCheckout, webhook }
