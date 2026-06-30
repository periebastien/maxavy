const router = require('express').Router()
const controller = require('./places.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.get('/search', authMiddleware, controller.search)

module.exports = router
