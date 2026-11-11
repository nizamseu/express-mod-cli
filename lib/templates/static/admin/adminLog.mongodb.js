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

module.exports = { AdminLogModel, addLog, recentLogs };
