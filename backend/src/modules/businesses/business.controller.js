const service = require('./business.service')

async function create(req, res) {
  try {
    const business = await service.create(req.body, req.user.id)
    res.status(201).json(business)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function list(req, res) {
  try {
    const businesses = await service.listForUser(req.user.id)
    res.json(businesses)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getOne(req, res) {
  try {
    const business = await service.getOne(req.params.id, req.user.id)
    res.json(business)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const business = await service.update(req.params.id, req.body, req.user.id)
    res.json(business)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function destroy(req, res) {
  try {
    await service.remove(req.params.id, req.user.id)
    res.status(204).end()
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { create, list, getOne, update, destroy }
