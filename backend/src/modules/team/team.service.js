const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')
const Business = require('../../models/Business')
const User = require('../../models/User')
const TeamMember = require('../../models/TeamMember')
const TeamInvitation = require('../../models/TeamInvitation')
const { encrypt, decrypt } = require('../../config/encryption')
const { sendTeamInviteEmail } = require('../../services/mail.service')

const ROLES = ['admin', 'editor', 'viewer']
const INVITE_TTL_DAYS = 7

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function emailHash(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Seul le propriétaire ou un membre « admin » peut administrer l'équipe.
async function assertCanManage(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  if (business.owner_id === userId) return business
  const member = await TeamMember.findOne({ where: { business_id: businessId, user_id: userId } })
  if (!member || !member.accepted_at || member.role !== 'admin') {
    throw { status: 403, message: 'Réservé au propriétaire ou à un administrateur' }
  }
  return business
}

// Rôle effectif de l'utilisateur courant sur ce business (pour le front).
async function myRole(business, userId) {
  if (business.owner_id === userId) return 'owner'
  const member = await TeamMember.findOne({ where: { business_id: business.id, user_id: userId } })
  return member?.accepted_at ? member.role : null
}

async function list(businessId, userId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  const role = await myRole(business, userId)
  if (!role) throw { status: 403, message: 'Accès refusé' }

  const owner = await User.findByPk(business.owner_id)
  const members = await TeamMember.findAll({ where: { business_id: businessId }, order: [['created_at', 'ASC']] })
  const userIds = members.map(m => m.user_id)
  const users = userIds.length ? await User.findAll({ where: { id: { [Op.in]: userIds } } }) : []
  const userById = Object.fromEntries(users.map(u => [u.id, u]))

  const memberRows = members.map(m => {
    const u = userById[m.user_id]
    return {
      id: m.id,
      kind: 'member',
      user_id: m.user_id,
      email: u?.email || null,
      firstname: u?.firstname || null,
      lastname: u?.lastname || null,
      role: m.role,
      status: m.accepted_at ? 'active' : 'pending',
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
    }
  })

  // On n'affiche que les invitations d'invités SANS compte (les autres apparaissent déjà comme
  // TeamMember pending, via email_hash des utilisateurs déjà rattachés).
  const memberEmailHashes = new Set(
    userIds.map(id => userById[id]).filter(Boolean).map(u => emailHash(u.email))
  )
  const pendingInvites = (await TeamInvitation.findAll({
    where: { business_id: businessId, status: 'pending' },
    order: [['created_at', 'ASC']],
  })).filter(i => !memberEmailHashes.has(i.email_hash))
  const inviteRows = pendingInvites.map(i => ({
    id: i.id,
    kind: 'invitation',
    user_id: null,
    email: decrypt(i.email),
    firstname: null,
    lastname: null,
    role: i.role,
    status: 'invited',
    invited_at: i.created_at,
    accepted_at: null,
    expired: i.expires_at < new Date(),
  }))

  return {
    my_role: role,
    owner: owner ? {
      id: owner.id,
      email: owner.email,
      firstname: owner.firstname,
      lastname: owner.lastname,
      role: 'owner',
      status: 'active',
    } : null,
    members: memberRows,
    invitations: inviteRows,
  }
}

async function invite(businessId, userId, { email, role }) {
  const business = await assertCanManage(businessId, userId)

  const cleanEmail = normalizeEmail(email)
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw { status: 400, message: 'Email invalide' }
  }
  if (!ROLES.includes(role)) throw { status: 400, message: 'Rôle invalide' }

  const owner = await User.findByPk(business.owner_id)
  if (owner && normalizeEmail(owner.email) === cleanEmail) {
    throw { status: 400, message: 'Cette personne est déjà propriétaire de l\'entreprise' }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  const existingUser = await User.findOne({ where: { email: cleanEmail } })

  if (existingUser) {
    // L'utilisateur a déjà un compte : on le rattache directement en « pending » (accepted_at NULL).
    const already = await TeamMember.findOne({ where: { business_id: businessId, user_id: existingUser.id } })
    if (already?.accepted_at) throw { status: 409, message: 'Cette personne est déjà membre de l\'équipe' }
    if (already) {
      await already.update({ role, invited_at: new Date() }) // ré-invitation d'un pending
    } else {
      await TeamMember.create({
        business_id: businessId,
        user_id: existingUser.id,
        role,
        invited_at: new Date(),
        accepted_at: null,
      })
    }
  }

  // On trace TOUJOURS une team_invitations (elle porte le token_hash → source de vérité de l'acceptation),
  // que l'invité ait déjà un compte ou non. Le token n'est jamais stocké en clair.
  const existingInvite = await TeamInvitation.findOne({
    where: { business_id: businessId, email_hash: emailHash(cleanEmail), status: 'pending' },
  })
  if (existingInvite) {
    await existingInvite.update({ role, token_hash: hashToken(token), expires_at: expiresAt, invited_by: userId })
  } else {
    await TeamInvitation.create({
      business_id: businessId,
      email: encrypt(cleanEmail),
      email_hash: emailHash(cleanEmail),
      role,
      token_hash: hashToken(token),
      status: 'pending',
      invited_by: userId,
      expires_at: expiresAt,
    })
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  const acceptUrl = `${appUrl}/invitation?token=${token}`
  try {
    await sendTeamInviteEmail({
      to: cleanEmail,
      businessName: business.name,
      role,
      acceptUrl,
      isExistingUser: !!existingUser,
    })
  } catch (err) {
    throw { status: 502, message: `Échec d'envoi de l'email d'invitation : ${err.message}` }
  }

  return { email: cleanEmail, role, status: existingUser ? 'pending' : 'invited' }
}

// Résout un token d'invitation (existingUser pending OU team_invitations) en un contexte exploitable.
async function resolveToken(token) {
  if (!token) throw { status: 400, message: 'Token manquant' }
  const th = hashToken(token)

  const invitation = await TeamInvitation.findOne({ where: { token_hash: th } })
  if (invitation) {
    if (invitation.status !== 'pending') throw { status: 400, message: 'Cette invitation a déjà été utilisée' }
    if (invitation.expires_at < new Date()) throw { status: 400, message: 'Invitation expirée' }
    const business = await Business.findByPk(invitation.business_id)
    if (!business) throw { status: 404, message: 'Entreprise introuvable' }
    return { type: 'invitation', invitation, business, email: decrypt(invitation.email) }
  }

  throw { status: 404, message: 'Invitation introuvable ou déjà traitée' }
}

// Aperçu public de l'invitation (avant acceptation) — pour afficher le nom de l'entreprise et savoir
// si un mot de passe est requis (nouveau compte) ou non (compte existant).
async function preview(token) {
  const { invitation, business, email } = await resolveToken(token)
  const existingUser = await User.findOne({ where: { email: normalizeEmail(email) } })
  return {
    business_name: business.name,
    email,
    role: invitation.role,
    needs_account: !existingUser,
  }
}

// Acceptation. Deux chemins :
//   - Utilisateur connecté (userId fourni) : on rattache son compte.
//   - Sinon : email d'invitation → soit compte existant (rejeté ici, doit se connecter), soit création
//     de compte avec mot de passe fourni.
async function accept({ token, userId, password, firstname, lastname }) {
  const { invitation, business, email } = await resolveToken(token)
  const cleanEmail = normalizeEmail(email)

  let user
  if (userId) {
    user = await User.findByPk(userId)
    if (!user) throw { status: 404, message: 'Utilisateur introuvable' }
    // Un utilisateur connecté ne peut accepter que si l'invitation cible bien son email.
    if (normalizeEmail(user.email) !== cleanEmail) {
      throw { status: 403, message: 'Cette invitation ne correspond pas à votre compte connecté' }
    }
  } else {
    user = await User.findOne({ where: { email: cleanEmail } })
    if (user) {
      throw { status: 409, message: 'Un compte existe déjà pour cet email — connectez-vous pour accepter l\'invitation' }
    }
    if (!password || String(password).length < 8) {
      throw { status: 400, message: 'Mot de passe requis (8 caractères minimum)' }
    }
    const password_hash = await bcrypt.hash(String(password), 12)
    user = await User.create({
      email: cleanEmail,
      password_hash,
      firstname: firstname || null,
      lastname: lastname || null,
      role: 'member',
      auth_provider: 'local',
      email_verified: true,
    })
  }

  // Active (ou crée) le membership.
  const existingMember = await TeamMember.findOne({ where: { business_id: business.id, user_id: user.id } })
  if (existingMember) {
    if (!existingMember.accepted_at) await existingMember.update({ accepted_at: new Date(), role: invitation.role })
  } else {
    await TeamMember.create({
      business_id: business.id,
      user_id: user.id,
      role: invitation.role,
      invited_at: invitation.created_at,
      accepted_at: new Date(),
    })
  }

  await invitation.update({ status: 'accepted' })

  const jwtToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )
  const { password_hash, google_id, ...safeUser } = user.toJSON()
  return { user: safeUser, token: jwtToken, business_id: business.id }
}

async function updateRole(businessId, userId, memberId, role) {
  await assertCanManage(businessId, userId)
  if (!ROLES.includes(role)) throw { status: 400, message: 'Rôle invalide' }
  const member = await TeamMember.findOne({ where: { id: memberId, business_id: businessId } })
  if (!member) throw { status: 404, message: 'Membre introuvable' }
  await member.update({ role })
  return { id: member.id, role: member.role }
}

async function remove(businessId, userId, memberId) {
  await assertCanManage(businessId, userId)
  // memberId peut désigner un TeamMember OU une invitation en attente (invité sans compte).
  const member = await TeamMember.findOne({ where: { id: memberId, business_id: businessId } })
  if (member) {
    await member.destroy()
    return
  }
  const invitation = await TeamInvitation.findOne({ where: { id: memberId, business_id: businessId } })
  if (invitation) {
    await invitation.update({ status: 'revoked' })
    return
  }
  throw { status: 404, message: 'Membre introuvable' }
}

module.exports = { list, invite, accept, preview, updateRole, remove }
