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

router.get('/config',  ctrl.getConfig)
router.put('/config',  ctrl.updateConfig)

router.get('/competitors',             ctrl.listCompetitors)
router.post('/competitors',            ctrl.createCompetitor)
router.delete('/competitors/:id',      ctrl.removeCompetitor)
router.post('/competitors/recompute',  ctrl.recomputeCompetitors)
router.get('/competitors/detected',    ctrl.detectedCompetitors)

router.post('/scans',            ctrl.createScan)
router.get('/scans',             ctrl.listScans)
router.get('/scans/:id',         ctrl.getScan)
router.post('/scans/:id/refresh', ctrl.refreshScan)

router.post('/runs',     ctrl.createRun)
router.get('/runs',      ctrl.listRuns)
router.get('/runs/:id',  ctrl.getRun)

router.get('/trend', ctrl.getTrend)

module.exports = router
