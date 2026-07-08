const router = require('express').Router()
const ctrl = require('./admin-schedule.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { superAdminMiddleware } = require('../../middlewares/super-admin.middleware')

router.use(authMiddleware, superAdminMiddleware)
router.get('/geogrid-month', ctrl.listGeogridMonth)

module.exports = router
