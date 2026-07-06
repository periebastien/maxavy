const service = require('./admin-accounts.service')

async function list(req, res) {
  try {
    const accounts = await service.list({ q: req.query.q })
    res.json(accounts)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function updatePlan(req, res) {
  try {
    const business = await service.updatePlan(req.params.businessId, req.body.plan_id ?? null)
    res.json({ id: business.id, plan_id: business.plan_id })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { list, updatePlan }
