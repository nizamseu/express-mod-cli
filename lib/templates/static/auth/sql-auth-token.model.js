const { DataTypes } = require('sequelize');
const { getSqlConnection } = require('../../config/sql');

const sequelize = getSqlConnection('__CONNECTION__');

/** One-time tokens sent by email (verify the address, reset the password) */
const AuthTokenModel = sequelize.define('AuthToken', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  // SHA-256 of the token - the token itself is only in the email
  tokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  usedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'auth_tokens',
  timestamps: true
});

module.exports = AuthTokenModel;
