const router = require('express').Router()
const ctrl = require('./tag.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')

router.use(authMiddleware)
router.post('/',      ctrl.create)
router.get('/',       ctrl.list)
router.patch('/:id',  ctrl.update)
router.delete('/:id', ctrl.remove)

module.exports = router
