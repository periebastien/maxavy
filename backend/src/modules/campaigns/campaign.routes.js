const router = require('express').Router()
const controller = require('./campaign.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)
router.post('/',              controller.create)
router.get('/',               controller.list)
router.patch('/:id/pause',   controller.pause)
router.patch('/:id/resume',  controller.resume)
router.patch('/:id/cancel',  controller.cancel)

module.exports = router
