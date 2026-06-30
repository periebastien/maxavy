const service = require('./public.service')

async function getCollectPage(req, res) {
  try {
    const data = await service.getCollectPage(req.params.businessSlug, req.params.locationSlug)
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function submitFeedback(req, res) {
  try {
    const result = await service.submitFeedback(req.params.businessSlug, req.params.locationSlug, req.body)
    res.status(201).json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { getCollectPage, submitFeedback }
