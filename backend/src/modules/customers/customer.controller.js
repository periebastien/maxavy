const service = require('./customer.service')

async function create(req, res) {
  try {
    const customer = await service.create(req.body, req.body.business_id, req.user.id)
    res.status(201).json(customer)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function list(req, res) {
  try {
    const customers = await service.list(req.query.business_id, req.user.id)
    res.json(customers)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getOne(req, res) {
  try {
    const customer = await service.getOne(req.params.id, req.user.id)
    res.json(customer)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const customer = await service.update(req.params.id, req.body, req.user.id)
    res.json(customer)
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
