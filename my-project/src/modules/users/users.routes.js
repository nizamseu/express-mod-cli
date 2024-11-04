const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');

router.get('/', usersController.getAll);
router.get('/:id', usersController.getById);
router.post('/', usersController.create);
router.patch('/:id', usersController.update);
router.delete('/:id', usersController.remove);

module.exports = router;
