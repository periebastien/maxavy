const Business = require('../../models/Business')
const Location = require('../../models/Location')
const PrivateFeedback = require('../../models/PrivateFeedback')

// Résout l'entreprise + la localisation depuis les deux slugs de l'URL publique.
//404 générique (pas d'info sur ce qui manque) — page publique, on ne révèle rien.
async function resolve(businessSlug, locationSlug) {
  const business = await Business.findOne({ where: { slug: businessSlug } })
  if (!business) throw { status: 404, message: 'Page introuvable' }
  const location = await Location.findOne({ where: { business_id: business.id, slug: locationSlug } })
  if (!location) throw { status: 404, message: 'Page introuvable' }
  return { business, location }
}

// Payload public minimal — n'expose jamais owner_id, crédits, etc.
async function getCollectPage(businessSlug, locationSlug) {
  const { business, location } = await resolve(businessSlug, locationSlug)
  return {
    business: {
      name:                 business.name,
      slug:                 business.slug,
      website_url:          business.website_url || null,
      feedback_page_config: business.feedback_page_config || {},
    },
    location: {
      id:                location.id,
      name:              location.name,
      slug:              location.slug,
      address:           location.address || null,
      google_place_id:   location.google_place_id,
      google_place_name: location.google_place_name || null,
      website_url:       location.website_url || null,
    },
  }
}

// Enregistre un retour privé (chemin note ≤ 3). business_id/location_id viennent du serveur,
// jamais du client → pas d'injection possible vers une autre entreprise.
async function submitFeedback(businessSlug, locationSlug, data) {
  const { business, location } = await resolve(businessSlug, locationSlug)

  const rating = Number(data.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw { status: 400, message: 'Note invalide' }
  }
  const comment = (data.comment || '').trim()
  if (!comment) throw { status: 400, message: 'Le commentaire est requis' }

  await PrivateFeedback.create({
    business_id:  business.id,
    location_id:  location.id,
    rating,
    comment:      comment.slice(0, 5000),
    author_name:  (data.author_name  || '').trim().slice(0, 255) || null,
    author_email: (data.author_email || '').trim().slice(0, 255) || null,
  })

  return { ok: true }
}

module.exports = { getCollectPage, submitFeedback }
