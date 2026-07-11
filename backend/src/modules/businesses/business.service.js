const { Op } = require('sequelize')
const Business = require('../../models/Business')
const TeamMember = require('../../models/TeamMember')
const Location = require('../../models/Location')
const { grantWelcomeCredits } = require('../credits/credits.service')
const { getPlanForOwnerId } = require('../../services/plan-resolver')

// Plafond du nombre d'entreprises qu'un propriétaire peut créer : celui du plan de l'owner
// (ou du plan Gratuit en repli si pas de plan actif). NULL = illimité.
async function effectiveMaxBusinesses(userId) {
  const plan = await getPlanForOwnerId(userId)
  return plan?.max_businesses ?? null
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(name) {
  const base = slugify(name)
  let slug = base
  let i = 1
  while (await Business.findOne({ where: { slug } })) {
    slug = `${base}-${++i}`
  }
  return slug
}

async function create({ name, website_url, country, timezone }, userId) {
  const owned = await Business.findAll({ where: { owner_id: userId } })
  const limit = await effectiveMaxBusinesses(userId)
  if (limit !== null && owned.length >= limit) {
    throw { status: 403, message: `Limite de ${limit} entreprise(s) atteinte pour votre plan` }
  }

  const slug = await uniqueSlug(name)
  const business = await Business.create({
    name, slug,
    website_url: website_url || null,
    country:     country     || 'FR',
    timezone:    timezone    || 'Europe/Paris',
    owner_id:    userId,
  })
  await grantWelcomeCredits(business.id)
  return business
}

async function listForUser(userId) {
  const owned = await Business.findAll({ where: { owner_id: userId } })

  const memberships = await TeamMember.findAll({ where: { user_id: userId } })
  const memberIds = memberships.map(m => m.business_id)

  const memberBusinesses = memberIds.length
    ? await Business.findAll({ where: { id: { [Op.in]: memberIds }, owner_id: { [Op.ne]: userId } } })
    : []

  const roleByBusinessId = new Map(memberships.map(m => [m.business_id, m.role]))

  return [
    ...owned.map(b => attachRole(b, 'owner')),
    ...memberBusinesses.map(b => attachRole(b, roleByBusinessId.get(b.id))),
  ]
}

function attachRole(business, my_role) {
  const json = business.toJSON()
  json.my_role = my_role
  return json
}

async function getOne(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)
  return business
}

async function update(businessId, data, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  if (business.owner_id !== userId) throw { status: 403, message: 'Seul le propriétaire peut modifier' }

  const allowed = [
    'name', 'website_url', 'country', 'timezone', 'feedback_page_config',
    'logo_url', 'contact_email', 'contact_phone', 'address', 'notification_prefs', 'slug',
  ]
  const changes = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)))

  if (changes.slug !== undefined) {
    const slug = String(changes.slug || '').trim()
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw { status: 400, message: 'Slug invalide : minuscules, chiffres et tirets uniquement (kebab-case)' }
    }
    if (slug !== business.slug) {
      const taken = await Business.findOne({ where: { slug, id: { [Op.ne]: business.id } } })
      if (taken) throw { status: 409, message: 'Ce slug est déjà utilisé' }
    }
    changes.slug = slug
  }

  if (changes.notification_prefs !== undefined) {
    if (typeof changes.notification_prefs !== 'object' || Array.isArray(changes.notification_prefs) || changes.notification_prefs === null) {
      throw { status: 400, message: 'notification_prefs doit être un objet' }
    }
  }

  await business.update(changes)
  return business
}

// Contrôle d'accès centralisé, gouverne aussi les rôles d'équipe.
//   - Le propriétaire (owner_id) a TOUJOURS tous les droits — aucun TeamMember n'existe pour lui,
//     donc le comportement mono-utilisateur historique est strictement inchangé.
//   - Un membre rattaché (TeamMember accepté) accède au business ; un « viewer » est en lecture seule.
//   - opts.write === true → exige un rôle d'écriture (owner, admin ou editor).
// Rétrocompatible : appelé sans opts (défaut lecture), toute la logique existante reste identique.
async function assertAccess(business, userId, opts = {}) {
  if (business.owner_id === userId) return
  const member = await TeamMember.findOne({ where: { business_id: business.id, user_id: userId } })
  if (!member || !member.accepted_at) throw { status: 403, message: 'Accès refusé' }
  if (opts.write && member.role === 'viewer') {
    throw { status: 403, message: 'Votre rôle (lecteur) ne permet pas cette action' }
  }
}

async function remove(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  if (business.owner_id !== userId) throw { status: 403, message: 'Seul le propriétaire peut supprimer' }
  await Location.destroy({ where: { business_id: businessId } })
  await business.destroy()
}

module.exports = { create, listForUser, getOne, update, remove, assertAccess }
