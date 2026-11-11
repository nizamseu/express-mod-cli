import { Schema } from 'mongoose';
import { getMongoConnection } from '../config/mongodb';
import config from './admin.config';

export interface AdminLogEntry {
  action: 'add' | 'change' | 'delete' | 'import';
  resource: string;
  recordId?: string;
  recordTitle?: string;
  changes?: string;
  userId: string;
  userEmail: string;
}

/**
 * The admin log: who added, changed, deleted or imported what in the panel.
 * Only the names of changed fields are kept, never their values.
 */
const adminLogSchema = new Schema({
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

// Stored next to the users (see src/admin/admin.config.ts)
export const AdminLogModel = getMongoConnection(config.connection).model('AdminLog', adminLogSchema);

export async function addLog(entry: AdminLogEntry): Promise<void> {
  await AdminLogModel.create(entry);
}

/** The newest entries, of one user or of everyone */
export async function recentLogs({ userId, limit = 10 }: { userId?: string; limit?: number } = {}) {
  const docs = await AdminLogModel.find(userId ? { userId } : {}).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map(({ _id, __v, ...log }) => ({ id: String(_id), ...log }));
}
