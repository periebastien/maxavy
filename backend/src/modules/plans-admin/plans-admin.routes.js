const router = require('express').Router()
const ctrl = require('./plans-admin.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { superAdminMiddleware } = require('../../middlewares/super-admin.middleware')

router.use(authMiddleware, superAdminMiddleware)
router.get('/', ctrl.list)
router.post('/', ctrl.create)
router.put('/:planId', ctrl.update)
router.put('/:planId/rank-tracking', ctrl.updateRankTracking)

module.exports = router
