const service = require('./stripe.service')
const Plan = require('../../models/Plan')
const CreditPack = require('../../models/CreditPack')

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
  try {
    const packs = await CreditPack.findAll({ where: { active: true }, order: [['sort_order', 'ASC']] })
    res.json(packs.map(p => {
      const plain = p.toJSON()
      return { ...plain, price_per_credit: plain.credits > 0 ? Math.round((Number(plain.price) / plain.credits) * 10000) / 10000 : null }
    }))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
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
