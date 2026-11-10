import { Schema, type InferSchemaType } from 'mongoose';
import { getMongoConnection } from '../../config/mongodb';

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Set when the user opens the link in the verification email
  emailVerifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export type UserDocument = InferSchemaType<typeof userSchema>;

// The model lives on the "__CONNECTION__" connection (see src/config/databases.ts)
const UserModel = getMongoConnection('__CONNECTION__').model('User', userSchema);

export default UserModel;
