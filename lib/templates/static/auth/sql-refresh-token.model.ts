import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { getSqlConnection } from '../../config/sql';

class RefreshTokenModel extends Model<InferAttributes<RefreshTokenModel>, InferCreationAttributes<RefreshTokenModel>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare tokenHash: string;
  declare familyId: string;
  declare expiresAt: Date;
  declare revokedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

RefreshTokenModel.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
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
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  sequelize: getSqlConnection('__CONNECTION__'),
  modelName: 'RefreshToken',
  tableName: 'refresh_tokens',
  timestamps: true
});

export default RefreshTokenModel;
