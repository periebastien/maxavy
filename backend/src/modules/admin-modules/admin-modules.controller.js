const service = require('./admin-modules.service')

async function listBusinesses(req, res) {
  try {
    res.json(await service.listBusinesses())
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function listForBusiness(req, res) {
  try {
    res.json(await service.listForBusiness(req.query.business_id))
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function upsert(req, res) {
  try {
    const result = await service.upsert(req.params.businessId, req.params.moduleKey, req.body)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { listBusinesses, listForBusiness, upsert }
