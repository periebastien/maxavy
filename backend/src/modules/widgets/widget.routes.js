const router = require('express').Router()
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const ctrl = require('./widget.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { jsonRateLimitHandler } = require('../../middlewares/rate-limit-handler')

// Routes publiques (sans auth) — embarquées sur les sites clients.
// CORS ouvert (le widget est chargé depuis n'importe quel domaine client) + rate limit dédié permissif.
const publicCors = cors({ origin: '*' })
const publicLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 300, handler: jsonRateLimitHandler })

router.get('/runtime.js',   publicCors, publicLimiter, ctrl.getRuntimeJs)
router.get('/:id/public',   publicCors, publicLimiter, ctrl.getPublic)
router.get('/:id/embed.js', publicCors, publicLimiter, ctrl.getEmbedJs)

router.use(authMiddleware)
router.post('/preview', ctrl.preview)
router.post('/',        ctrl.create)
router.get('/',         ctrl.list)
router.get('/:id',      ctrl.getOne)
router.patch('/:id',    ctrl.update)
router.delete('/:id',   ctrl.remove)

module.exports = router
