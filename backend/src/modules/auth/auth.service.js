const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const User = require('../../models/User')
const { sendResetEmail } = require('../../services/mail.service')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

async function register({ email, password, firstname, lastname }) {
  const existing = await User.findOne({ where: { email } })
  if (existing) throw { status: 409, message: 'Email déjà utilisé' }

  const password_hash = await bcrypt.hash(password, 12)
  const user = await User.create({ email, password_hash, firstname, lastname, auth_provider: 'local' })
  return { user: sanitize(user), token: generateToken(user) }
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } })
  if (!user) throw { status: 401, message: 'Identifiants incorrects' }
  if (!user.password_hash) throw { status: 401, message: 'Ce compte utilise la connexion Google' }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) throw { status: 401, message: 'Identifiants incorrects' }

  return { user: sanitize(user), token: generateToken(user) }
}

async function googleAuth({ credential }) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()
  const { sub: google_id, email, given_name: firstname, family_name: lastname, picture: avatar_url } = payload

  let user = await User.findOne({ where: { google_id } })

  if (!user) {
    user = await User.findOne({ where: { email } })
    if (user) {
      await user.update({ google_id, auth_provider: 'google', email_verified: true })
    } else {
      user = await User.create({
        email, firstname, lastname, avatar_url,
        google_id, auth_provider: 'google', email_verified: true,
      })
    }
  }

  return { user: sanitize(user), token: generateToken(user) }
}

async function forgotPassword({ email }) {
  const user = await User.findOne({ where: { email } })
  // Réponse identique qu'un compte existe ou non (sécurité)
  if (!user || user.auth_provider !== 'local') return

  const token = jwt.sign(
    { type: 'password_reset', id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`
  await sendResetEmail(user.email, resetUrl)
}

async function resetPassword({ token, password }) {
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    throw { status: 400, message: 'Lien invalide ou expiré' }
  }

  if (payload.type !== 'password_reset') {
    throw { status: 400, message: 'Lien invalide' }
  }

  const user = await User.findByPk(payload.id)
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' }

  const password_hash = await bcrypt.hash(password, 12)
  await user.update({ password_hash, auth_provider: 'local' })
}

async function me(userId) {
  const user = await User.findByPk(userId)
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' }
  return sanitize(user)
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )
}

function sanitize(user) {
  const { password_hash, google_id, ...safe } = user.toJSON()
  return safe
}

module.exports = { register, login, googleAuth, forgotPassword, resetPassword, me }
