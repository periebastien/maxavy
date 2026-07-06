const router = require('express').Router()
const ctrl = require('./reviews.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)
router.get('/',                  ctrl.list)
router.post('/sync',             ctrl.sync)
router.get('/sync/status',       ctrl.syncStatus)
router.get('/competitors/stats', ctrl.competitorStats)
router.post('/competitors/sync', ctrl.competitorSync)
router.put('/:id/tags',          ctrl.setTags)

module.exports = router
