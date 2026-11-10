import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { getSqlConnection } from '../../config/sql';

class UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare passwordHash: string;
  declare name: CreationOptional<string | null>;
  declare role: CreationOptional<string>;
  declare emailVerifiedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

UserModel.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    set(value: string) {
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
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  // The model lives on the "__CONNECTION__" connection (see src/config/databases.ts)
  sequelize: getSqlConnection('__CONNECTION__'),
  modelName: 'User',
  tableName: 'users',
  timestamps: true
});

export default UserModel;
