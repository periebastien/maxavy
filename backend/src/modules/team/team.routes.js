const router = require('express').Router()
const controller = require('./team.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

// Routes publiques (acceptation d'invitation — l'invité peut ne pas encore avoir de compte).
router.get('/invite/preview', controller.previewInvite)
router.post('/accept',        controller.accept)

// Routes authentifiées.
router.use(authMiddleware)
router.get('/',            controller.list)
router.post('/invite',     controller.invite)
router.put('/:id/role',    controller.updateRole)
router.delete('/:id',      controller.remove)

module.exports = router
