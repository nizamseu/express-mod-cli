const { DataTypes } = require('sequelize');
const { getSqlConnection } = require('../../config/sql');

const sequelize = getSqlConnection('__CONNECTION__');

const RefreshTokenModel = sequelize.define('RefreshToken', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // SHA-256 of the token - the token itself is never stored
  tokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  // All tokens of one login share a family
  familyId: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  revokedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'refresh_tokens',
  timestamps: true
});

module.exports = RefreshTokenModel;
