const service = require('./team.service')

async function list(req, res) {
  try {
    const result = await service.list(req.query.business_id, req.user.id)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function invite(req, res) {
  try {
    const result = await service.invite(req.body.business_id, req.user.id, {
      email: req.body.email,
      role: req.body.role,
    })
    res.status(201).json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

// Public — aperçu d'une invitation (nom entreprise, email, si un compte doit être créé).
async function previewInvite(req, res) {
  try {
    const result = await service.preview(req.query.token)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

// Public — acceptation. userId présent uniquement si un token JWT valide accompagne la requête.
async function accept(req, res) {
  try {
    let userId = null
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken')
        const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] })
        userId = payload.id
      } catch { /* token invalide → traité comme non connecté */ }
    }
    const result = await service.accept({
      token: req.body.token,
      userId,
      password: req.body.password,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
    })
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function updateRole(req, res) {
  try {
    const result = await service.updateRole(req.body.business_id, req.user.id, req.params.id, req.body.role)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function remove(req, res) {
  try {
    await service.remove(req.query.business_id, req.user.id, req.params.id)
    res.status(204).end()
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { list, invite, previewInvite, accept, updateRole, remove }
