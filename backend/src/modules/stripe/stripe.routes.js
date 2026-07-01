const router = require('express').Router()
const express = require('express')
const ctrl = require('./stripe.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

// Webhook Stripe — raw body obligatoire (avant express.json)
router.post('/webhook', express.raw({ type: 'application/json' }), ctrl.webhook)

router.use(authMiddleware)
router.get('/plans',              ctrl.getPlans)
router.get('/packs',              ctrl.getPacks)
router.post('/checkout/subscribe', ctrl.subscribeCheckout)
router.post('/checkout/credits',   ctrl.creditsCheckout)

module.exports = router
