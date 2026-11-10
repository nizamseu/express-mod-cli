import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { getSqlConnection } from '../../config/sql';

/** One-time tokens sent by email (verify the address, reset the password) */
class AuthTokenModel extends Model<InferAttributes<AuthTokenModel>, InferCreationAttributes<AuthTokenModel>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare type: string;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare usedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AuthTokenModel.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
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
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  sequelize: getSqlConnection('__CONNECTION__'),
  modelName: 'AuthToken',
  tableName: 'auth_tokens',
  timestamps: true
});

export default AuthTokenModel;
