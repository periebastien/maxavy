const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const controller = require('./public.controller')
const { jsonRateLimitHandler } = require('../../middlewares/rate-limit-handler')

// Routes PUBLIQUES (aucun authMiddleware) : la page de collecte est accessible sans compte.

// Limiteur dédié anti-spam sur le dépôt de feedback (plus strict que le global /api/).
const feedbackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, handler: jsonRateLimitHandler })

router.get('/collect/:businessSlug/:locationSlug', controller.getCollectPage)
router.post('/collect/:businessSlug/:locationSlug/feedback', feedbackLimiter, controller.submitFeedback)

module.exports = router
