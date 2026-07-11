const cron = require('node-cron')
const { Op } = require('sequelize')
const Invitation = require('../models/Invitation')
const InvitationCampaign = require('../models/InvitationCampaign')
const Customer = require('../models/Customer')
const Business = require('../models/Business')
const Location = require('../models/Location')
const Credit = require('../models/Credit')
const User = require('../models/User')
const { decrypt } = require('../config/encryption')
const { sendInvitationEmail } = require('../services/mail.service')
const { getCost } = require('../services/credit-costs')

async function processOne(inv) {
  const [customer, business, location] = await Promise.all([
    Customer.findByPk(inv.customer_id),
    Business.findByPk(inv.business_id),
    inv.location_id ? Location.findByPk(inv.location_id) : Promise.resolve(null),
  ])

  if (!customer || !business) {
    await inv.update({ status: 'failed' })
    return 'failed'
  }

  const cost = await getCost('invitation_email')
  const owner = await User.findByPk(business.owner_id)
  if (!owner || owner.credit_balance < cost) {
    // Pas de crédit — on met la campagne en pause si applicable
    if (inv.campaign_id) {
      await InvitationCampaign.update({ status: 'paused' }, { where: { id: inv.campaign_id } })
    }
    await inv.update({ status: 'failed' })
    return 'no_credit'
  }

  if (inv.channel === 'sms') {
    await inv.update({ status: 'failed' })
    if (inv.campaign_id) await InvitationCampaign.increment('failed_count', { by: 1, where: { id: inv.campaign_id } })
    return 'failed'
  }

  const email = decrypt(customer.email)
  if (inv.channel === 'email' && !email) {
    await inv.update({ status: 'failed' })
    if (inv.campaign_id) await InvitationCampaign.increment('failed_count', { by: 1, where: { id: inv.campaign_id } })
    return 'failed'
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  const collectUrl = location
    ? `${appUrl}/avis/${business.slug}/${location.slug}`
    : `${appUrl}/avis/${business.slug}`

  try {
    await sendInvitationEmail({ to: email, firstname: customer.firstname, businessName: business.name, collectUrl })
  } catch {
    await inv.update({ status: 'failed', sent_at: new Date() })
    if (inv.campaign_id) await InvitationCampaign.increment('failed_count', { by: 1, where: { id: inv.campaign_id } })
    return 'failed'
  }

  await inv.update({ status: 'sent', sent_at: new Date() })
  await User.decrement('credit_balance', { by: cost, where: { id: business.owner_id } })
  await Credit.create({ business_id: inv.business_id, amount: -cost, action_type: 'invitation', source: 'plan' })
  await customer.update({ status: 'invited' })

  if (inv.campaign_id) {
    await InvitationCampaign.increment('sent_count', { by: 1, where: { id: inv.campaign_id } })
    const campaign = await InvitationCampaign.findByPk(inv.campaign_id)
    if (campaign && campaign.sent_count + 1 >= campaign.total_count) {
      await campaign.update({ status: 'completed' })
    }
  }

  return 'sent'
}

function startScheduledInvitationsJob() {
  cron.schedule('* * * * *', async () => {
    try {
      const pending = await Invitation.findAll({
        where: {
          status: 'pending',
          scheduled_at: { [Op.lte]: new Date() },
          campaign_id:  { [Op.ne]: null },
        },
        limit: 30,
        order: [['scheduled_at', 'ASC']],
      })

      // Filtrer les campagnes actives
      const runningCampaigns = new Set()
      for (const inv of pending) {
        if (inv.campaign_id) {
          if (!runningCampaigns.has(inv.campaign_id)) {
            const campaign = await InvitationCampaign.findByPk(inv.campaign_id)
            if (campaign?.status === 'running') runningCampaigns.add(inv.campaign_id)
          }
          if (!runningCampaigns.has(inv.campaign_id)) continue
        }
        await processOne(inv)
      }
    } catch (err) {
      console.error('[cron] Erreur invitations planifiées :', err.message)
    }
  })

  console.log('[cron] Job invitations planifiées démarré')
}

module.exports = { startScheduledInvitationsJob }
