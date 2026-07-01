const router = require('express').Router()
const ctrl = require('./widget.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

// Routes publiques (sans auth) — embarquées sur les sites clients
router.get('/runtime.js',   ctrl.getRuntimeJs)
router.get('/:id/public',   ctrl.getPublic)
router.get('/:id/embed.js', ctrl.getEmbedJs)

router.use(authMiddleware)
router.post('/preview', ctrl.preview)
router.post('/',        ctrl.create)
router.get('/',         ctrl.list)
router.get('/:id',      ctrl.getOne)
router.patch('/:id',    ctrl.update)
router.delete('/:id',   ctrl.remove)

module.exports = router
