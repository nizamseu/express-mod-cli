const { VERIFY_EMAIL_HOURS, RESET_PASSWORD_MINUTES } = require('../../config/auth');

/**
 * The emails authentication sends. Change the wording and design here.
 */

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const greeting = (user) => (user.name ? `Hi ${user.name},` : 'Hi,');

const html = (user, intro, link, label, outro) => `<p>${escapeHtml(greeting(user))}</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(link)}">${escapeHtml(label)}</a></p>
<p>${escapeHtml(outro)}</p>`;

/** Sent after registering, and by POST /auth/resend-verification */
function verifyEmailMessage(user, link) {
  const intro = 'Please confirm your email address by opening this link:';
  const outro = `The link works for ${VERIFY_EMAIL_HOURS} hours. If you didn't create an account, you can ignore this email.`;

  return {
    to: user.email,
    subject: 'Confirm your email address',
    text: `${greeting(user)}\n\n${intro}\n${link}\n\n${outro}`,
    html: html(user, intro, link, 'Confirm email address', outro),
  };
}

/** Sent by POST /auth/forgot-password */
function resetPasswordMessage(user, link) {
  const intro = 'Someone asked to reset the password of your account. Open this link to choose a new one:';
  const outro = `The link works for ${RESET_PASSWORD_MINUTES} minutes and only once. If you didn't ask for it, you can ignore this email - your password stays the same.`;

  return {
    to: user.email,
    subject: 'Reset your password',
    text: `${greeting(user)}\n\n${intro}\n${link}\n\n${outro}`,
    html: html(user, intro, link, 'Reset password', outro),
  };
}

module.exports = { verifyEmailMessage, resetPasswordMessage };
