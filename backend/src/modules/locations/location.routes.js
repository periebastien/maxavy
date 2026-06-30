const router = require('express').Router()
const controller = require('./location.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)

router.post('/',      controller.create)
router.get('/',       controller.list)    // ?business_id=
router.get('/:id',    controller.getOne)
router.patch('/:id',  controller.update)
router.delete('/:id', controller.remove)

module.exports = router
