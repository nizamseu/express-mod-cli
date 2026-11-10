const { DataTypes } = require('sequelize');
const { getSqlConnection } = require('../../config/sql');

// The model lives on the "__CONNECTION__" connection (see src/config/databases.js)
const sequelize = getSqlConnection('__CONNECTION__');

const UserModel = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('email', String(value).trim().toLowerCase());
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user',
    validate: { isIn: [['user', 'admin']] }
  },
  // Set when the user opens the link in the verification email
  emailVerifiedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  timestamps: true
});

module.exports = UserModel;
