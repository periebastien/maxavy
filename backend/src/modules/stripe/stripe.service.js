const Business = require('../../models/Business')
const Plan = require('../../models/Plan')
const Credit = require('../../models/Credit')
const { assertAccess } = require('../businesses/business.service')

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw { status: 503, message: 'Stripe non configuré' }
  return require('stripe')(process.env.STRIPE_SECRET_KEY)
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { business_id: businessId, plan_id: planId },
    success_url: `${appUrl}/credits?checkout=success`,
    cancel_url:  `${appUrl}/pricing?checkout=cancel`,
    customer_email: business.owner_email || undefined,
  })

  return { url: session.url }
}

const CREDIT_PACKS = [
  { id: 'pack_50',  credits: 50,  price: 9,  label: 'Pack 50 crédits' },
  { id: 'pack_200', credits: 200, price: 29, label: 'Pack 200 crédits' },
  { id: 'pack_500', credits: 500, price: 59, label: 'Pack 500 crédits' },
]

async function createCreditsCheckout(businessId, userId, { packId }) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  const pack = CREDIT_PACKS.find(p => p.id === packId)
  if (!pack) throw { status: 400, message: 'Pack invalide' }

  const stripe = getStripe()
  const appUrl = process.env.APP_URL || 'http://localhost:5173'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: pack.price * 100,
        product_data: { name: pack.label },
      },
      quantity: 1,
    }],
    metadata: { business_id: businessId, credits: pack.credits, pack_id: packId },
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
      const businessId = session.metadata?.business_id

      if (session.mode === 'payment') {
        // Achat crédits à la carte
        const credits = parseInt(session.metadata?.credits || 0)
        if (businessId && credits > 0) {
          await Credit.create({ business_id: businessId, amount: credits, action_type: 'purchase', source: 'purchase' })
          await Business.increment('credit_balance', { by: credits, where: { id: businessId } })
        }
      }

      if (session.mode === 'subscription') {
        // Abonnement souscrit — on attend invoice.paid pour les crédits
        const planId = session.metadata?.plan_id
        if (businessId && planId) {
          await Business.update({ plan_id: planId }, { where: { id: businessId } })
        }
      }
      break
    }

    case 'invoice.paid': {
      // Renouvellement mensuel → attribuer les crédits du plan
      const invoice = event.data.object
      const sub = await getStripe().subscriptions.retrieve(invoice.subscription)
      const businessId = sub.metadata?.business_id
      if (!businessId) break

      const business = await Business.findByPk(businessId)
      if (!business?.plan_id) break

      const plan = await Plan.findByPk(business.plan_id)
      if (!plan?.monthly_credits) break

      await Credit.create({
        business_id: businessId,
        amount:      plan.monthly_credits,
        action_type: 'monthly_renewal',
        source:      'plan',
      })
      await Business.increment('credit_balance', { by: plan.monthly_credits, where: { id: businessId } })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const businessId = sub.metadata?.business_id
      if (businessId) {
        await Business.update({ plan_id: null }, { where: { id: businessId } })
      }
      break
    }
  }

  return { received: true }
}

module.exports = { createSubscriptionCheckout, createCreditsCheckout, handleWebhook, CREDIT_PACKS }
