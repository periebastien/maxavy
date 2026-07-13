const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const controller = require('./auth.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { jsonRateLimitHandler } = require('../../middlewares/rate-limit-handler')

const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, handler: jsonRateLimitHandler })

router.post('/register',        controller.register)
router.post('/login',           controller.login)
router.post('/google',          controller.googleAuth)
router.post('/forgot-password', controller.forgotPassword)
router.post('/reset-password',  controller.resetPassword)
router.get('/me',               authMiddleware, controller.me)
router.patch('/me',             authMiddleware, controller.updateProfile)
router.put('/me/password',      authMiddleware, sensitiveLimiter, controller.changePassword)

module.exports = router
