const router = require('express').Router()
const controller = require('./customer.controller')
const { authMiddleware } = require('../../middlewares/auth.middleware')
const { upload } = require('./customer.import')

router.use(authMiddleware)

router.post('/import',  upload.single('file'), controller.importFromCsv)
router.get('/stats',    controller.stats)
router.get('/search',   controller.search)
router.post('/',        controller.create)
router.get('/',         controller.list)
router.get('/:id',     controller.getOne)
router.patch('/:id',   controller.update)
router.delete('/:id',  controller.destroy)

module.exports = router
