const mongoose = require('mongoose');
const { getMongoConnection } = require('../../config/mongodb');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // SHA-256 of the token - the token itself is never stored
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  // All tokens of one login share a family
  familyId: {
    type: String,
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0 // MongoDB deletes expired tokens on its own (TTL index)
  },
  revokedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const RefreshTokenModel = getMongoConnection('__CONNECTION__').model('RefreshToken', refreshTokenSchema);

module.exports = RefreshTokenModel;
