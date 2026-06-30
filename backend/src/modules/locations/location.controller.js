const service = require('./location.service')

async function create(req, res) {
  try {
    const location = await service.create(req.body, req.user.id)
    res.status(201).json(location)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function list(req, res) {
  try {
    const locations = await service.listForBusiness(req.query.business_id, req.user.id)
    res.json(locations)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getOne(req, res) {
  try {
    const location = await service.getOne(req.params.id, req.user.id)
    res.json(location)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const location = await service.update(req.params.id, req.body, req.user.id)
    res.json(location)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function remove(req, res) {
  try {
    await service.remove(req.params.id, req.user.id)
    res.status(204).end()
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { create, list, getOne, update, remove }
