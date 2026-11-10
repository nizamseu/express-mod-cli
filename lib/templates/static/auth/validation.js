const { z } = require('zod');

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes of a password
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes');

const registerSchema = z.object({
  email,
  password: newPassword,
  name: z.string().trim().min(1).max(100).optional()
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required')
});

// Browsers send the refresh token as a cookie; other clients may send it in the body
const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'The new password must be different from the current one',
    path: ['newPassword']
  });

// The token from the link in the email
const emailToken = z.string().trim().min(1, 'Token is required');

const verifyEmailSchema = z.object({ token: emailToken });

// forgot-password and resend-verification
const emailSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: emailToken,
  newPassword
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyEmailSchema,
  emailSchema,
  resetPasswordSchema
};
