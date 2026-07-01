const router = require('express').Router()
const ctrl = require('./credits.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)
router.get('/balance',  ctrl.balance)
router.get('/history',  ctrl.history)
router.post('/add',     ctrl.add)

module.exports = router
