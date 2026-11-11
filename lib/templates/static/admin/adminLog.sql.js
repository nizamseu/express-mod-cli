const { DataTypes } = require('sequelize');
const { getSqlConnection } = require('../config/sql');
const config = require('./admin.config');

/**
 * The admin log: who added, changed, deleted or imported what in the panel.
 * Only the names of changed fields are kept, never their values.
 * The admin_logs table is created by a migration.
 */
const AdminLogModel = getSqlConnection(config.connection).define('AdminLog', {
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['add', 'change', 'delete', 'import']] }
  },
  resource: { type: DataTypes.STRING, allowNull: false },
  recordId: { type: DataTypes.STRING },
  recordTitle: { type: DataTypes.STRING },
  changes: { type: DataTypes.TEXT },
  userId: { type: DataTypes.STRING, allowNull: false },
  userEmail: { type: DataTypes.STRING, allowNull: false }
}, {
  tableName: 'admin_logs',
  timestamps: true,
  updatedAt: false
});

async function addLog(entry) {
  await AdminLogModel.create(entry);
}

/** The newest entries, of one user or of everyone */
async function recentLogs({ userId, limit = 10 } = {}) {
  const rows = await AdminLogModel.findAll({
    where: userId ? { userId } : {},
    order: [['createdAt', 'DESC']],
    limit,
    raw: true
  });
  return rows.map((row) => ({ ...row, id: String(row.id) }));
}

module.exports = { AdminLogModel, addLog, recentLogs };
