const service = require('./plans-admin.service')

async function list(req, res) {
  try {
    res.json(await service.list())
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function updateRankTracking(req, res) {
  try {
    const result = await service.updateRankTracking(req.params.planId, req.body)
    res.json({ rank_tracking: result })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function create(req, res) {
  try {
    const plan = await service.create(req.body)
    res.status(201).json(plan)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const plan = await service.update(req.params.planId, req.body)
    res.json(plan)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { list, create, update, updateRankTracking }
