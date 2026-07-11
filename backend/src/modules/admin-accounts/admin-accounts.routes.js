const router = require('express').Router()
const ctrl = require('./admin-accounts.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { superAdminMiddleware } = require('../../middlewares/super-admin.middleware')

router.use(authMiddleware, superAdminMiddleware)
router.get('/', ctrl.list)
router.put('/:businessId/plan', ctrl.updatePlan)
router.put('/owner/:userId/plan', ctrl.updateOwnerPlan)

module.exports = router
