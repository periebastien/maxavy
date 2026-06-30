const router = require('express').Router()
const controller = require('./google.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

// callback = redirect depuis Google, pas de JWT dans les headers
router.get('/callback', controller.callback)

router.use(authMiddleware)
router.get('/auth-url',    controller.getAuthUrl)
router.get('/status',      controller.getStatus)
router.delete('/disconnect', controller.disconnect)

module.exports = router
