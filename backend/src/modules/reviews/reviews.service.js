const { OAuth2Client } = require('google-auth-library')
const { Op } = require('sequelize')
const { decrypt, encrypt } = require('../../config/encryption')
const GoogleConnection = require('../../models/GoogleConnection')
const Location = require('../../models/Location')
const Review = require('../../models/Review')
const Tag = require('../../models/Tag')
const ReviewTag = require('../../models/ReviewTag')
const Business = require('../../models/Business')
const { assertAccess } = require('../businesses/business.service')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

function makeClient(conn) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_BUSINESS_REDIRECT_URI,
  )
  client.setCredentials({
    access_token:  conn.access_token  ? decrypt(conn.access_token)  : null,
    refresh_token: conn.refresh_token ? decrypt(conn.refresh_token) : null,
    expiry_date:   conn.expires_at    ? new Date(conn.expires_at).getTime() : null,
  })
  client.on('tokens', async (tokens) => {
    const update = {}
    if (tokens.access_token) update.access_token = encrypt(tokens.access_token)
    if (tokens.expiry_date)  update.expires_at   = new Date(tokens.expiry_date)
    if (Object.keys(update).length) await conn.update(update)
  })
  return client
}

async function apiFetch(client, url) {
  const headers = await client.getRequestHeaders(url)
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GMB ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function listGmbAccounts(client) {
  const data = await apiFetch(client, 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts')
  return data.accounts || []
}

async function listGmbLocations(client, accountName) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,metadata`
  const data = await apiFetch(client, url)
  return data.locations || []
}

async function fetchGmbReviews(client, locationName, pageToken) {
  let url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`
  if (pageToken) url += `&pageToken=${pageToken}`
  return apiFetch(client, url)
}

async function syncForBusiness(businessId) {
  const conn = await GoogleConnection.findOne({ where: { business_id: businessId } })
  if (!conn) return { skipped: true, reason: 'no_connection' }

  const locations = await Location.findAll({ where: { business_id: businessId } })
  if (!locations.length) return { skipped: true, reason: 'no_locations' }

  const client = makeClient(conn)
  const accounts = await listGmbAccounts(client)
  if (!accounts.length) return { skipped: true, reason: 'no_gmb_accounts' }

  let totalUpserted = 0

  for (const account of accounts) {
    const gmbLocations = await listGmbLocations(client, account.name)

    for (const loc of locations) {
      const gmbLoc = gmbLocations.find(g => g.metadata?.placeId === loc.google_place_id)
      if (!gmbLoc) continue

      let pageToken = null
      do {
        const data = await fetchGmbReviews(client, gmbLoc.name, pageToken)
        const reviews = data.reviews || []
        pageToken = data.nextPageToken || null

        for (const r of reviews) {
          const replyText = r.reviewReply?.comment || null
          const replyTime = r.reviewReply?.updateTime ? new Date(r.reviewReply.updateTime) : null

          await Review.upsert({
            external_id:  r.reviewId,
            location_id:  loc.id,
            business_id:  businessId,
            platform:     'google',
            author_name:  r.reviewer?.displayName || null,
            rating:       STAR_MAP[r.starRating] || null,
            text:         r.comment || null,
            published_at: r.createTime ? new Date(r.createTime) : null,
            replied:      !!replyText,
            reply_text:   replyText,
            reply_time:   replyTime,
          }, { conflictFields: ['external_id'] })

          totalUpserted++
        }
      } while (pageToken)
    }
  }

  await conn.update({ last_synced_at: new Date() })
  return { synced: true, upserted: totalUpserted }
}

async function syncAll() {
  const connections = await GoogleConnection.findAll()
  const results = []
  for (const conn of connections) {
    try {
      const res = await syncForBusiness(conn.business_id)
      results.push({ business_id: conn.business_id, ...res })
    } catch (err) {
      console.error(`[reviews-sync] business ${conn.business_id}:`, err.message)
      results.push({ business_id: conn.business_id, error: err.message })
    }
  }
  return results
}

async function listReviews(businessId, userId, { locationId, page = 1, limit = 20 } = {}) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const where = { business_id: businessId }
  if (locationId) where.location_id = locationId

  const offset = (page - 1) * limit
  const { count, rows } = await Review.findAndCountAll({
    where,
    order: [['published_at', 'DESC']],
    limit,
    offset,
  })

  const reviews = await attachTags(rows)
  return { total: count, page, limit, reviews }
}

async function attachTags(rows) {
  const ids = rows.map(r => r.id)
  if (!ids.length) return rows.map(r => ({ ...r.toJSON(), tags: [] }))

  const links = await ReviewTag.findAll({ where: { review_id: { [Op.in]: ids } } })
  const tagIds = [...new Set(links.map(l => l.tag_id))]
  const tags = tagIds.length ? await Tag.findAll({ where: { id: { [Op.in]: tagIds } } }) : []
  const tagById = Object.fromEntries(tags.map(t => [t.id, t.toJSON()]))

  const byReview = {}
  for (const l of links) {
    if (!tagById[l.tag_id]) continue
    ;(byReview[l.review_id] ||= []).push(tagById[l.tag_id])
  }

  return rows.map(r => ({ ...r.toJSON(), tags: byReview[r.id] || [] }))
}

async function setReviewTags(reviewId, businessId, userId, tagIds = []) {
  if (!UUID_RE.test(reviewId)) throw { status: 404, message: 'Avis introuvable' }

  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const review = await Review.findOne({ where: { id: reviewId, business_id: businessId } })
  if (!review) throw { status: 404, message: 'Avis introuvable' }

  const ids = [...new Set(tagIds)].filter(Boolean)
  if (ids.length) {
    if (!ids.every(id => UUID_RE.test(id))) throw { status: 400, message: 'Tag invalide' }
    const owned = await Tag.findAll({ where: { id: { [Op.in]: ids }, business_id: businessId } })
    if (owned.length !== ids.length) throw { status: 400, message: 'Tag invalide' }
  }

  await ReviewTag.destroy({ where: { review_id: reviewId } })
  if (ids.length) await ReviewTag.bulkCreate(ids.map(tag_id => ({ review_id: reviewId, tag_id })))

  const tags = ids.length ? await Tag.findAll({ where: { id: { [Op.in]: ids } } }) : []
  return tags
}

async function triggerSync(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return syncForBusiness(businessId)
}

module.exports = { syncAll, syncForBusiness, listReviews, triggerSync, setReviewTags }
