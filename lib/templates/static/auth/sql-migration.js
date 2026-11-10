const { DataTypes } = require('sequelize');

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false }
};

/** @param {{ context: import('sequelize').QueryInterface }} params */
async function up({ context: queryInterface }) {
  await queryInterface.createTable('users', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'user' },
    emailVerifiedAt: { type: DataTypes.DATE },
    ...timestamps
  });

  await queryInterface.createTable('refresh_tokens', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    familyId: { type: DataTypes.STRING(64), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE },
    ...timestamps
  });

  await queryInterface.addIndex('refresh_tokens', ['familyId']);

  await queryInterface.createTable('auth_tokens', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    type: { type: DataTypes.STRING(32), allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE },
    ...timestamps
  });
}

/** @param {{ context: import('sequelize').QueryInterface }} params */
async function down({ context: queryInterface }) {
  await queryInterface.dropTable('auth_tokens');
  await queryInterface.dropTable('refresh_tokens');
  await queryInterface.dropTable('users');
}

module.exports = { up, down };
