const mongoose = require('mongoose');
const { getMongoConnection } = require('../../config/mongodb');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Set when the user opens the link in the verification email
  emailVerifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// The model lives on the "__CONNECTION__" connection (see src/config/databases.js)
const UserModel = getMongoConnection('__CONNECTION__').model('User', userSchema);

module.exports = UserModel;
