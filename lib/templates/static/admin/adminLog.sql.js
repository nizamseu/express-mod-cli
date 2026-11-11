const { DataTypes, Op } = require('sequelize');
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

/** A day as YYYY-MM-DD in the server's time zone */
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Number of admin actions per day for the last `days` days (oldest first) */
async function activityByDay(days = 14) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const logs = await AdminLogModel.findAll({ where: { createdAt: { [Op.gte]: start } }, attributes: ['createdAt'], limit: 20000, raw: true });
  const counts = new Map();
  for (const log of logs) {
    const day = dayKey(new Date(log.createdAt));
    counts.set(day, (counts.get(day) || 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dayKey(day);
    return { day: key, count: counts.get(key) || 0 };
  });
}

module.exports = { AdminLogModel, addLog, recentLogs, activityByDay };
