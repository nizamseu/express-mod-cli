const express = require('express');
const router = express.Router();
const Users = require('./users.model');

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const model = new Users(req.app.locals.db);
    const items = await model.findAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Get one users
router.get('/:id', async (req, res, next) => {
  try {
    const model = new Users(req.app.locals.db);
    const item = await model.findOne(req.params.id);
    if (!item) return res.status(404).json({ message: 'users not found' });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Create users
router.post('/', async (req, res, next) => {
  try {
    const model = new Users(req.app.locals.db);
    const newItem = await model.create(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
});

// Update users
router.patch('/:id', async (req, res, next) => {
  try {
    const model = new Users(req.app.locals.db);
    const updatedItem = await model.update(req.params.id, req.body);
    if (!updatedItem) return res.status(404).json({ message: 'users not found' });
    res.json(updatedItem);
  } catch (error) {
    next(error);
  }
});

// Delete users
router.delete('/:id', async (req, res, next) => {
  try {
    const model = new Users(req.app.locals.db);
    await model.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
