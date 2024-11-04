const express = require('express');
const router = express.Router();
const productsController = require('./products.controller');

router.get('/', productsController.getAll);
router.get('/:id', productsController.getById);
router.post('/', productsController.create);
router.patch('/:id', productsController.update);
router.delete('/:id', productsController.remove);

module.exports = router;
