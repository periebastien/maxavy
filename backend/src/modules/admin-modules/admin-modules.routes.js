const router = require('express').Router()
const ctrl = require('./admin-modules.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { superAdminMiddleware } = require('../../middlewares/super-admin.middleware')

router.use(authMiddleware, superAdminMiddleware)
router.get('/businesses', ctrl.listBusinesses)
router.get('/', ctrl.listForBusiness)
router.put('/:businessId/:moduleKey', ctrl.upsert)

module.exports = router
