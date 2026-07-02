const router = require('express').Router()
const ctrl = require('./rank-tracking.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)
router.get('/quota',           ctrl.quota)
router.get('/grid-preview',    ctrl.preview)
router.post('/keywords',       ctrl.create)
router.get('/keywords',        ctrl.list)
router.patch('/keywords/:id',  ctrl.update)
router.delete('/keywords/:id', ctrl.remove)

router.post('/scans',            ctrl.createScan)
router.get('/scans',             ctrl.listScans)
router.get('/scans/:id',         ctrl.getScan)
router.post('/scans/:id/refresh', ctrl.refreshScan)

module.exports = router
