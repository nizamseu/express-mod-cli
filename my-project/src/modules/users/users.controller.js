const usersModel = require('./users.model');

async function getAll(req, res, next) {
  try {
    const items = await usersModel.findAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const item = await usersModel.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'users not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const newItem = await usersModel.create(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const updatedItem = await usersModel.update(req.params.id, req.body);
    if (!updatedItem) {
      return res.status(404).json({ message: 'users not found' });
    }
    res.json(updatedItem);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await usersModel.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
