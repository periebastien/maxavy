const service = require('./rank-tracking.service')
const scanService = require('./scan.service')

async function create(req, res) {
  try {
    const kw = await service.create(req.query.business_id, req.user.id, req.body)
    res.status(201).json(kw)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function list(req, res) {
  try {
    const keywords = await service.list(req.query.business_id, req.user.id, req.query.location_id)
    res.json(keywords)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function update(req, res) {
  try {
    const kw = await service.update(req.params.id, req.query.business_id, req.user.id, req.body)
    res.json(kw)
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

async function quota(req, res) {
  try {
    const status = await service.getQuotaStatus(req.query.business_id, req.user.id)
    res.json(status)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function preview(req, res) {
  try {
    const grid = await service.previewGrid(req.query.business_id, req.user.id, req.query)
    res.json(grid)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function createScan(req, res) {
  try {
    const scan = await scanService.createScan(req.query.business_id, req.user.id, req.body.keyword_id)
    res.status(201).json(scan)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function listScans(req, res) {
  try {
    const scans = await scanService.listScans(req.query.business_id, req.user.id, req.query.keyword_id)
    res.json(scans)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getScan(req, res) {
  try {
    const result = await scanService.getScan(req.params.id, req.query.business_id, req.user.id)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function refreshScan(req, res) {
  try {
    const scan = await scanService.refreshScan(req.params.id, req.query.business_id, req.user.id)
    res.json(scan)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { create, list, update, remove, quota, preview, createScan, listScans, getScan, refreshScan }
