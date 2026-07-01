const service = require('./reviews.service')

async function list(req, res) {
  try {
    const { location_id, page, limit } = req.query
    const result = await service.listReviews(req.query.business_id, req.user.id, {
      locationId: location_id,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
    })
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function sync(req, res) {
  try {
    const result = await service.triggerSync(req.query.business_id, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[reviews/sync]', err.message)
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function setTags(req, res) {
  try {
    const tags = await service.setReviewTags(req.params.id, req.query.business_id, req.user.id, req.body.tag_ids || [])
    res.json({ tags })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { list, sync, setTags }
