const service = require('./auth.service')

async function register(req, res) {
  try {
    const result = await service.register(req.body)
    res.status(201).json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function login(req, res) {
  try {
    const result = await service.login(req.body)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function googleAuth(req, res) {
  try {
    const result = await service.googleAuth(req.body)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function forgotPassword(req, res) {
  try {
    await service.forgotPassword(req.body)
    res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function resetPassword(req, res) {
  try {
    await service.resetPassword(req.body)
    res.json({ message: 'Mot de passe mis à jour avec succès.' })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function me(req, res) {
  try {
    const user = await service.me(req.user.id)
    res.json(user)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { register, login, googleAuth, forgotPassword, resetPassword, me }
