const router = require('express').Router()
const ctrl = require('./admin-credits.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { superAdminMiddleware } = require('../../middlewares/super-admin.middleware')

router.use(authMiddleware, superAdminMiddleware)

router.get('/packs', ctrl.listPacks)
router.post('/packs', ctrl.createPack)
router.put('/packs/:id', ctrl.updatePack)
router.delete('/packs/:id', ctrl.deletePack)

router.get('/costs', ctrl.listCosts)
router.put('/costs', ctrl.updateCosts)

module.exports = router
