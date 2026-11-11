const mongoose = require('mongoose');
const { getMongoConnection } = require('../config/mongodb');
const config = require('./admin.config');

/**
 * The admin log: who added, changed, deleted or imported what in the panel.
 * Only the names of changed fields are kept, never their values.
 */
const adminLogSchema = new mongoose.Schema({
  action: { type: String, required: true, enum: ['add', 'change', 'delete', 'import'] },
  resource: { type: String, required: true },
  recordId: { type: String },
  recordTitle: { type: String },
  changes: { type: String },
  userId: { type: String, required: true },
  userEmail: { type: String, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

adminLogSchema.index({ createdAt: -1 });

// Stored next to the users (see src/admin/admin.config.js)
const AdminLogModel = getMongoConnection(config.connection).model('AdminLog', adminLogSchema);

async function addLog(entry) {
  await AdminLogModel.create(entry);
}

/** The newest entries, of one user or of everyone */
async function recentLogs({ userId, limit = 10 } = {}) {
  const docs = await AdminLogModel.find(userId ? { userId } : {}).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map(({ _id, __v, ...log }) => ({ id: String(_id), ...log }));
}

/** A day as YYYY-MM-DD in the server's time zone */
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Number of admin actions per day for the last `days` days (oldest first) */
async function activityByDay(days = 14) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const logs = await AdminLogModel.find({ createdAt: { $gte: start } }).select('createdAt').limit(20000).lean();
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
