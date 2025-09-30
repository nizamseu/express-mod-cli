/**
 * Generate model file content for a module using Mongoose
 * @param {string} moduleName - The name of the module
 * @returns {string} - Model file content
 */
const generateModelContent = (moduleName) => {
  const capitalizedName =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

  return `
const mongoose = require('mongoose');

// Define the schema for ${moduleName}
const ${moduleName}Schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Create and export the model
const ${capitalizedName} = mongoose.model('${capitalizedName}', ${moduleName}Schema);

module.exports = ${capitalizedName};
`;
};

/**
 * Generate controller file content for a module using Mongoose
 * @param {string} moduleName - The name of the module
 * @returns {string} - Controller file content
 */
const generateControllerContent = (moduleName) => {
  const capitalizedName =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

  return `
const ${capitalizedName} = require('./${moduleName}.model');

/**
 * Get all ${moduleName} documents
 */
async function getAll(req, res, next) {
  try {
    const items = await ${capitalizedName}.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: items,
      message: '${capitalizedName} retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single ${moduleName} by ID
 */
async function getById(req, res, next) {
  try {
    const item = await ${capitalizedName}.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '${capitalizedName} not found'
      });
    }
    res.json({
      success: true,
      data: item,
      message: '${capitalizedName} retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new ${moduleName}
 */
async function create(req, res, next) {
  try {
    const newItem = new ${capitalizedName}(req.body);
    const savedItem = await newItem.save();
    
    res.status(201).json({
      success: true,
      data: savedItem,
      message: '${capitalizedName} created successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a ${moduleName} by ID
 */
async function update(req, res, next) {
  try {
    const updatedItem = await ${capitalizedName}.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: '${capitalizedName} not found'
      });
    }
    
    res.json({
      success: true,
      data: updatedItem,
      message: '${capitalizedName} updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a ${moduleName} by ID
 */
async function remove(req, res, next) {
  try {
    const deletedItem = await ${capitalizedName}.findByIdAndDelete(req.params.id);
    
    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: '${capitalizedName} not found'
      });
    }
    
    res.json({
      success: true,
      data: deletedItem,
      message: '${capitalizedName} deleted successfully'
    });
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
`;
};

/**
 * Generate routes file content for a module
 * @param {string} moduleName - The name of the module
 * @returns {string} - Routes file content
 */
const generateRouteContent = (moduleName) => {
  return `
const express = require('express');
const router = express.Router();
const ${moduleName}Controller = require('./${moduleName}.controller');

// CRUD routes
router.get('/', ${moduleName}Controller.getAll);
router.get('/:id', ${moduleName}Controller.getById);
router.post('/', ${moduleName}Controller.create);
router.patch('/:id', ${moduleName}Controller.update);
router.delete('/:id', ${moduleName}Controller.remove);

module.exports = router;
`;
};

module.exports = {
  generateModelContent,
  generateControllerContent,
  generateRouteContent,
};
