const service = require('./widget.service')
const { runtimeSource, embedSource } = require('./widget.runtime')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const apiBase = (req) => process.env.APP_URL || `${req.protocol}://${req.get('host')}`

async function create(req, res) {
  try {
    const widget = await service.create(req.query.business_id, req.user.id, req.body)
    res.status(201).json(widget)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function list(req, res) {
  try {
    const widgets = await service.list(req.query.business_id, req.user.id)
    res.json(widgets)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getOne(req, res) {
  try {
    const widget = await service.getOne(req.params.id, req.query.business_id, req.user.id)
    res.json(widget)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const widget = await service.update(req.params.id, req.query.business_id, req.user.id, req.body)
    res.json(widget)
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

async function preview(req, res) {
  try {
    const data = await service.preview(req.query.business_id, req.user.id, req.body)
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getPublic(req, res) {
  try {
    const data = await service.getPublic(req.params.id)
    res.set('Cache-Control', 'public, max-age=120')
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

function getRuntimeJs(req, res) {
  res.type('application/javascript')
  res.set('Cache-Control', 'public, max-age=300')
  res.send(runtimeSource())
}

function getEmbedJs(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(404).type('application/javascript').send('// widget introuvable')
  res.type('application/javascript')
  res.set('Cache-Control', 'public, max-age=300')
  res.send(embedSource(req.params.id, apiBase(req)))
}

module.exports = { create, list, getOne, update, remove, preview, getPublic, getRuntimeJs, getEmbedJs }
