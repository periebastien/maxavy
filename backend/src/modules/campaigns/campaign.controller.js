const service = require('./campaign.service')

async function create(req, res, next) {
  try {
    const { businessId, name, channel, locationId, customerIds, filter, ratePer, rateUnit } = req.body
    if (!businessId || !channel || !locationId || !ratePer || !rateUnit) {
      return res.status(400).json({ message: 'Paramètres manquants' })
    }
    if (!filter && !customerIds?.length) {
      return res.status(400).json({ message: 'Sélectionnez un filtre ou des clients' })
    }
    if (!['day', 'week'].includes(rateUnit)) {
      return res.status(400).json({ message: 'rateUnit doit être "day" ou "week"' })
    }
    if (Number(ratePer) < 1) {
      return res.status(400).json({ message: 'La cadence doit être au moins 1' })
    }
    const campaign = await service.create({
      businessId, name, channel, locationId,
      customerIds, filter, ratePer: Number(ratePer), rateUnit,
      userId: req.user.id,
    })
    res.status(201).json(campaign)
  } catch (err) {
    next(err)
  }
}

async function list(req, res, next) {
  try {
    const { businessId } = req.query
    if (!businessId) return res.status(400).json({ message: 'businessId requis' })
    const campaigns = await service.list(businessId, req.user.id)
    res.json(campaigns)
  } catch (err) {
    next(err)
  }
}

async function pause(req, res, next) {
  try {
    const campaign = await service.pause(req.params.id, req.body.businessId, req.user.id)
    res.json(campaign)
  } catch (err) {
    next(err)
  }
}

async function resume(req, res, next) {
  try {
    const campaign = await service.resume(req.params.id, req.body.businessId, req.user.id)
    res.json(campaign)
  } catch (err) {
    next(err)
  }
}

async function cancel(req, res, next) {
  try {
    const campaign = await service.cancel(req.params.id, req.body.businessId, req.user.id)
    res.json(campaign)
  } catch (err) {
    next(err)
  }
}

module.exports = { create, list, pause, resume, cancel }
