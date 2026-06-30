const router = require('express').Router()
const controller = require('./business.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)

router.post('/',    controller.create)
router.get('/',     controller.list)
router.get('/:id',  controller.getOne)
router.patch('/:id',  controller.update)
router.delete('/:id', controller.destroy)

module.exports = router
