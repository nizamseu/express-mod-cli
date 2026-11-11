import { DataTypes } from 'sequelize';
import { getSqlConnection } from '../config/sql';
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
 * The admin_logs table is created by a migration.
 */
export const AdminLogModel = getSqlConnection(config.connection).define('AdminLog', {
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

export async function addLog(entry: AdminLogEntry): Promise<void> {
  await AdminLogModel.create({ ...entry });
}

/** The newest entries, of one user or of everyone */
export async function recentLogs({ userId, limit = 10 }: { userId?: string; limit?: number } = {}) {
  const rows = (await AdminLogModel.findAll({
    where: userId ? { userId } : {},
    order: [['createdAt', 'DESC']],
    limit,
    raw: true
  })) as unknown as (AdminLogEntry & { id: number; createdAt: Date })[];
  return rows.map((row) => ({ ...row, id: String(row.id) }));
}
