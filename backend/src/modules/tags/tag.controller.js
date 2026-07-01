const service = require('./tag.service')

async function create(req, res) {
  try {
    const tag = await service.create(req.query.business_id, req.user.id, req.body)
    res.status(201).json(tag)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function list(req, res) {
  try {
    const tags = await service.list(req.query.business_id, req.user.id)
    res.json(tags)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const tag = await service.update(req.params.id, req.query.business_id, req.user.id, req.body)
    res.json(tag)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function remove(req, res) {
  try {
    await service.remove(req.params.id, req.query.business_id, req.user.id)
    res.status(204).end()
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { create, list, update, remove }
