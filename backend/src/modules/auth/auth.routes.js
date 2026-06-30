const router = require('express').Router()
const controller = require('./auth.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.post('/register',        controller.register)
router.post('/login',           controller.login)
router.post('/google',          controller.googleAuth)
router.post('/forgot-password', controller.forgotPassword)
router.post('/reset-password',  controller.resetPassword)
router.get('/me',               authMiddleware, controller.me)

module.exports = router
