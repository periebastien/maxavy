const { OAuth2Client } = require('google-auth-library')
const jwt = require('jsonwebtoken')
const { encrypt } = require('../../config/encryption')
const GoogleConnection = require('../../models/GoogleConnection')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const { assertAccess } = require('../businesses/business.service')

const VERIFY_TIMEOUT_MS = 7000

// Vérifie que le compte Google connecté gère bien une des fiches (place_id) du business.
// Ne doit jamais faire échouer le callback : toute erreur -> { match: null, error: '...' }.
async function verifyLocationMatch(businessId, accessToken) {
  try {
    const locations = await Location.findAll({ where: { business_id: businessId }, attributes: ['google_place_id'] })
    const placeIds = new Set(locations.map(l => l.google_place_id).filter(Boolean))
    if (placeIds.size === 0) return { match: null, error: 'Aucune fiche avec place_id sur ce business' }

    const signal = AbortSignal.timeout(VERIFY_TIMEOUT_MS)
    const headers = { Authorization: `Bearer ${accessToken}` }

    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers, signal })
    if (!accountsRes.ok) {
      return { match: null, error: `accounts API ${accountsRes.status}` }
    }
    const accountsBody = await accountsRes.json()
    const accounts = accountsBody.accounts || []
    if (accounts.length === 0) {
      return { match: null, error: 'Aucun compte Business Profile trouvé' }
    }

    const foundPlaceIds = new Set()
    for (const account of accounts) {
      let pageToken
      do {
        const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`)
        url.searchParams.set('readMask', 'name,title,metadata')
        if (pageToken) url.searchParams.set('pageToken', pageToken)
        const locRes = await fetch(url, { headers, signal })
        if (!locRes.ok) {
          return { match: null, error: `locations API ${locRes.status}` }
        }
        const locBody = await locRes.json()
        for (const loc of locBody.locations || []) {
          if (loc.metadata?.placeId) foundPlaceIds.add(loc.metadata.placeId)
        }
        pageToken = locBody.nextPageToken
      } while (pageToken)
    }

    const match = [...placeIds].some(pid => foundPlaceIds.has(pid))
    return { match, error: null }
  } catch (err) {
    return { match: null, error: err.message || 'Erreur de vérification inconnue' }
  }
}

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
    payload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] })
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

  let verified = { match: null, error: null }
  if (tokens.access_token) {
    verified = await verifyLocationMatch(businessId, tokens.access_token)
  }

  const existing = await GoogleConnection.findOne({ where: { business_id: businessId } })
  const data = {
    access_token:             tokens.access_token  ? encrypt(tokens.access_token)  : null,
    refresh_token:            tokens.refresh_token ? encrypt(tokens.refresh_token) : (existing?.refresh_token ?? null),
    scopes:                   tokens.scope  ?? null,
    expires_at:               tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    google_account_email:     email,
    verified_location_match:  verified.match,
    verification_error:       verified.error,
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
    verified_location_match: conn.verified_location_match,
    verification_error: conn.verification_error,
  }
}

async function disconnect(businessId, userId) {
  await assertBusiness(businessId, userId)
  await GoogleConnection.destroy({ where: { business_id: businessId } })
}

module.exports = { getAuthUrl, handleCallback, getStatus, disconnect }
