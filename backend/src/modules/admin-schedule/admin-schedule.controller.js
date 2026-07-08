const service = require('./admin-schedule.service')

async function listGeogridMonth(req, res) {
  try {
    res.json(await service.listGeogridMonth())
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { listGeogridMonth }
