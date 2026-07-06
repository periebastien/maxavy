const Customer = require('../../models/Customer')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const Invitation = require('../../models/Invitation')
const Credit = require('../../models/Credit')
const { assertAccess } = require('../businesses/business.service')
const { decrypt } = require('../../config/encryption')
const { sendInvitationEmail } = require('../../services/mail.service')

async function send({ customerId, channel, locationId, businessId, userId }) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId, { write: true })

  const customer = await Customer.findOne({ where: { id: customerId, business_id: businessId } })
  if (!customer) throw { status: 404, message: 'Client introuvable' }

  const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
  if (!location) throw { status: 404, message: 'Localisation introuvable' }

  if (business.credit_balance <= 0) {
    throw { status: 402, message: 'Crédits insuffisants — rechargez votre compte pour envoyer des invitations' }
  }

  if (channel === 'sms') {
    throw { status: 503, message: 'SMS non disponible : configurez un numéro Twilio pour activer cette fonctionnalité' }
  }

  const email = decrypt(customer.email)
  if (channel === 'email' && !email) {
    throw { status: 400, message: 'Ce client n\'a pas d\'adresse email' }
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  const collectUrl = `${appUrl}/avis/${business.slug}/${location.slug}`

  try {
    await sendInvitationEmail({
      to: email,
      firstname: customer.firstname,
      businessName: business.name,
      collectUrl,
    })
  } catch (err) {
    await Invitation.create({ customer_id: customerId, business_id: businessId, location_id: locationId, channel, status: 'failed', sent_at: new Date() })
    throw { status: 500, message: `Échec d'envoi : ${err.message}` }
  }

  const invitation = await Invitation.create({
    customer_id: customerId,
    business_id: businessId,
    location_id: locationId,
    channel,
    status: 'sent',
    sent_at: new Date(),
  })

  await business.decrement('credit_balance', { by: 1 })
  await Credit.create({ business_id: businessId, amount: -1, action_type: 'invitation', source: 'plan' })
  await customer.update({ status: 'invited' })

  return invitation
}

module.exports = { send }
