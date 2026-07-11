const Business = require('../../models/Business')
const User = require('../../models/User')
const Plan = require('../../models/Plan')
const Credit = require('../../models/Credit')
const CreditPack = require('../../models/CreditPack')
const { assertAccess } = require('../businesses/business.service')

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw { status: 503, message: 'Stripe non configuré' }
  return require('stripe')(process.env.STRIPE_SECRET_KEY)
}

// credits.business_id est NOT NULL (historique par fiche) — les crédits étant désormais un pool par
// owner, on rattache la ligne d'audit à une entreprise possédée par l'owner (la plus ancienne), à
// seul titre de traçabilité. Le solde réel vit sur users.credit_balance, pas sur cette ligne.
async function anyOwnedBusinessId(userId) {
  const business = await Business.findOne({ where: { owner_id: userId }, order: [['created_at', 'ASC']] })
  return business?.id || null
}

async function createSubscriptionCheckout(businessId, userId, { planId, yearly = false }) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const plan = await Plan.findByPk(planId)
  if (!plan || !plan.active) throw { status: 404, message: 'Plan introuvable' }

  const priceId = yearly ? plan.stripe_price_id_yearly : plan.stripe_price_id
  if (!priceId) throw { status: 400, message: 'Ce plan n\'est pas encore disponible à l\'achat' }

  const stripe = getStripe()
  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  const owner = await User.findByPk(userId)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { business_id: businessId, user_id: userId, plan_id: planId },
    success_url: `${appUrl}/credits?checkout=success`,
    cancel_url:  `${appUrl}/pricing?checkout=cancel`,
    customer_email: owner?.email || undefined,
  })

  return { url: session.url }
}

async function createCreditsCheckout(businessId, userId, { packId }) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const pack = await CreditPack.findByPk(packId)
  if (!pack || !pack.active) throw { status: 400, message: 'Pack invalide' }

  const stripe = getStripe()
  const appUrl = process.env.APP_URL || 'http://localhost:5173'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(Number(pack.price) * 100),
        product_data: { name: pack.label },
      },
      quantity: 1,
    }],
    metadata: { business_id: businessId, user_id: userId, credits: pack.credits, pack_id: pack.id },
    success_url: `${appUrl}/credits?checkout=success`,
    cancel_url:  `${appUrl}/credits?checkout=cancel`,
  })

  return { url: session.url }
}

async function handleWebhook(rawBody, signature) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw { status: 503, message: 'Webhook secret non configuré' }

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    throw { status: 400, message: 'Signature webhook invalide' }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.user_id

      if (session.mode === 'payment') {
        // Achat crédits à la carte
        const credits = parseInt(session.metadata?.credits || 0)
        const businessId = session.metadata?.business_id || await anyOwnedBusinessId(userId)
        if (userId && credits > 0 && businessId) {
          await Credit.create({ business_id: businessId, amount: credits, action_type: 'purchase', source: 'purchase' })
          await User.increment('credit_balance', { by: credits, where: { id: userId } })
        }
      }

      if (session.mode === 'subscription') {
        // Abonnement souscrit — on attend invoice.paid pour les crédits
        const planId = session.metadata?.plan_id
        if (userId && planId) {
          await User.update(
            { plan_id: planId, stripe_customer_id: session.customer, stripe_subscription_id: session.subscription },
            { where: { id: userId } },
          )
        }
      }
      break
    }

    case 'invoice.paid': {
      // Renouvellement mensuel → attribuer les crédits du plan
      const invoice = event.data.object
      const user = await User.findOne({ where: { stripe_customer_id: invoice.customer } })
      if (!user?.plan_id) break

      const plan = await Plan.findByPk(user.plan_id)
      if (!plan?.monthly_credits) break

      const businessId = await anyOwnedBusinessId(user.id)
      if (businessId) {
        await Credit.create({
          business_id: businessId,
          amount:      plan.monthly_credits,
          action_type: 'monthly_renewal',
          source:      'plan',
        })
      }
      await User.increment('credit_balance', { by: plan.monthly_credits, where: { id: user.id } })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const user = await User.findOne({ where: { stripe_customer_id: sub.customer } })
      if (user) {
        await User.update({ plan_id: null }, { where: { id: user.id } })
      }
      break
    }
  }

  return { received: true }
}

module.exports = { createSubscriptionCheckout, createCreditsCheckout, handleWebhook }
