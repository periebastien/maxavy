const service = require('./admin-credits.service')

async function listPacks(req, res) {
  try {
    res.json(await service.listPacks())
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function createPack(req, res) {
  try {
    res.status(201).json(await service.createPack(req.body))
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function updatePack(req, res) {
  try {
    res.json(await service.updatePack(req.params.id, req.body))
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function deletePack(req, res) {
  try {
    res.json(await service.deletePack(req.params.id))
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function listCosts(req, res) {
  try {
    res.json(await service.listCosts())
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function updateCosts(req, res) {
  try {
    res.json(await service.updateCosts(req.body.costs))
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { listPacks, createPack, updatePack, deletePack, listCosts, updateCosts }
