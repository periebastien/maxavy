const router = require('express').Router()
const controller = require('./invitation.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)
router.post('/', controller.send)

module.exports = router
