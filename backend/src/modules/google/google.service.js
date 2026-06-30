const { OAuth2Client } = require('google-auth-library')
const jwt = require('jsonwebtoken')
const { encrypt } = require('../../config/encryption')
const GoogleConnection = require('../../models/GoogleConnection')
const Business = require('../../models/Business')
const { assertAccess } = require('../businesses/business.service')

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/business.manage',
]

function makeClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_BUSINESS_REDIRECT_URI,
  )
}

async function assertBusiness(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

async function getAuthUrl(businessId, userId) {
  await assertBusiness(businessId, userId)
  const state = jwt.sign({ businessId, userId }, process.env.JWT_SECRET, { expiresIn: '10m' })
  const client = makeClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
  })
}

async function handleCallback(code, state) {
  let payload
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET)
  } catch {
    throw { status: 400, message: 'State invalide ou expiré' }
  }
  const { businessId } = payload

  const client = makeClient()
  const { tokens } = await client.getToken(code)

  let email = null
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID })
      email = ticket.getPayload()?.email || null
    } catch {}
  }

  const existing = await GoogleConnection.findOne({ where: { business_id: businessId } })
  const data = {
    access_token:         tokens.access_token  ? encrypt(tokens.access_token)  : null,
    refresh_token:        tokens.refresh_token ? encrypt(tokens.refresh_token) : (existing?.refresh_token ?? null),
    scopes:               tokens.scope  ?? null,
    expires_at:           tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    google_account_email: email,
  }

  if (existing) {
    await existing.update(data)
  } else {
    await GoogleConnection.create({ business_id: businessId, ...data })
  }
}

async function getStatus(businessId, userId) {
  await assertBusiness(businessId, userId)
  const conn = await GoogleConnection.findOne({ where: { business_id: businessId } })
  if (!conn) return { connected: false }
  return {
    connected: true,
    email: conn.google_account_email,
    scopes: conn.scopes,
    expires_at: conn.expires_at,
    last_synced_at: conn.last_synced_at,
  }
}

async function disconnect(businessId, userId) {
  await assertBusiness(businessId, userId)
  await GoogleConnection.destroy({ where: { business_id: businessId } })
}

module.exports = { getAuthUrl, handleCallback, getStatus, disconnect }
