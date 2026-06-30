const service = require('./google.service')

async function getAuthUrl(req, res, next) {
  try {
    const { businessId } = req.query
    if (!businessId) return res.status(400).json({ message: 'businessId requis' })
    const url = await service.getAuthUrl(businessId, req.user.id)
    res.json({ url })
  } catch (err) {
    next(err)
  }
}

async function callback(req, res) {
  const { code, state, error } = req.query
  const base = `${process.env.APP_URL}/settings`
  if (error || !code || !state) {
    const reason = encodeURIComponent(error || 'Paramètres manquants')
    return res.redirect(`${base}?google=error&reason=${reason}`)
  }
  try {
    await service.handleCallback(code, state)
    res.redirect(`${base}?google=connected`)
  } catch (err) {
    const reason = encodeURIComponent(err.message || 'Erreur inconnue')
    res.redirect(`${base}?google=error&reason=${reason}`)
  }
}

async function getStatus(req, res, next) {
  try {
    const { businessId } = req.query
    if (!businessId) return res.status(400).json({ message: 'businessId requis' })
    const status = await service.getStatus(businessId, req.user.id)
    res.json(status)
  } catch (err) {
    next(err)
  }
}

async function disconnect(req, res, next) {
  try {
    const { businessId } = req.query
    if (!businessId) return res.status(400).json({ message: 'businessId requis' })
    await service.disconnect(businessId, req.user.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

module.exports = { getAuthUrl, callback, getStatus, disconnect }
