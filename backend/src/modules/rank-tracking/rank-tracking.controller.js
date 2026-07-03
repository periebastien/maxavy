const service = require('./rank-tracking.service')
const scanService = require('./scan.service')
const competitorService = require('./competitor.service')

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
    const status = await service.getQuotaStatus(req.query.business_id, req.user.id, req.query.location_id)
    res.json(status)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getConfig(req, res) {
  try {
    const config = await service.getConfig(req.query.business_id, req.user.id, req.query.location_id)
    res.json(config)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function updateConfig(req, res) {
  try {
    const config = await service.updateConfig(req.query.business_id, req.user.id, req.query.location_id, req.body)
    res.json(config)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function listCompetitors(req, res) {
  try {
    const competitors = await competitorService.list(req.query.business_id, req.user.id, req.query.config_id)
    res.json(competitors)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function createCompetitor(req, res) {
  try {
    const competitor = await competitorService.create(req.query.business_id, req.user.id, req.body)
    res.status(201).json(competitor)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function removeCompetitor(req, res) {
  try {
    await competitorService.remove(req.params.id, req.query.business_id, req.user.id)
    res.status(204).end()
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function recomputeCompetitors(req, res) {
  try {
    const result = await competitorService.recompute(req.query.business_id, req.user.id, req.body.config_id)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function detectedCompetitors(req, res) {
  try {
    const detected = await competitorService.detected(req.query.business_id, req.user.id, req.query.config_id)
    res.json(detected)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function competitorsTrend(req, res) {
  try {
    const trend = await competitorService.trend(req.query.business_id, req.user.id, req.query.keyword_id)
    res.json(trend)
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

async function createRun(req, res) {
  try {
    const run = await scanService.createRun(req.query.business_id, req.user.id, req.body.location_id)
    res.status(201).json(run)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function listRuns(req, res) {
  try {
    const runs = await scanService.listRuns(req.query.business_id, req.user.id, req.query.location_id)
    res.json(runs)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getRun(req, res) {
  try {
    const result = await scanService.getRun(req.params.id, req.query.business_id, req.user.id)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function runAverageMap(req, res) {
  try {
    const result = await scanService.getRunAverageMap(req.params.id, req.query.business_id, req.user.id)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function getTrend(req, res) {
  try {
    const trend = await scanService.getTrend(req.query.business_id, req.user.id, req.query.keyword_id)
    res.json(trend)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = {
  create, list, update, remove, quota, preview, createScan, listScans, getScan, refreshScan,
  getConfig, updateConfig, listCompetitors, createCompetitor, removeCompetitor, recomputeCompetitors,
  detectedCompetitors, competitorsTrend, createRun, listRuns, getRun, runAverageMap, getTrend,
}
