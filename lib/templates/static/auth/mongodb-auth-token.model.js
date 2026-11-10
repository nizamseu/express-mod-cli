const mongoose = require('mongoose');
const { getMongoConnection } = require('../../config/mongodb');

/** One-time tokens sent by email (verify the address, reset the password) */
const authTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['verify-email', 'reset-password'],
    required: true
  },
  // SHA-256 of the token - the token itself is only in the email
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0 // MongoDB deletes expired tokens on its own (TTL index)
  },
  usedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const AuthTokenModel = getMongoConnection('__CONNECTION__').model('AuthToken', authTokenSchema);

module.exports = AuthTokenModel;
