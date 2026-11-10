import { Schema, type InferSchemaType } from 'mongoose';
import { getMongoConnection } from '../../config/mongodb';

/** One-time tokens sent by email (verify the address, reset the password) */
const authTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['verify-email', 'reset-password'],
    required: true
  },
  // SHA-256 of the token - the token itself is only in the email
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0 // MongoDB deletes expired tokens on its own (TTL index)
  },
  usedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export type AuthTokenDocument = InferSchemaType<typeof authTokenSchema>;

const AuthTokenModel = getMongoConnection('__CONNECTION__').model('AuthToken', authTokenSchema);

export default AuthTokenModel;
