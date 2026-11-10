import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transport: Transporter | undefined;

/** The SMTP connection, or null when SMTP_HOST is not set */
function getTransport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;

  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

/**
 * Send an email through SMTP.
 * Without SMTP_HOST, development prints the email to the console instead;
 * production only logs that it could not be sent (emails contain secret links).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const smtp = getTransport();

  if (!smtp) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`Email "${message.subject}" to ${message.to} was not sent: SMTP_HOST is not set`);
      return;
    }
    console.log(`\n--- Email to ${message.to} (not sent: SMTP_HOST is not set) ---\nSubject: ${message.subject}\n\n${message.text}\n--- End of email ---\n`);
    return;
  }

  await smtp.sendMail({ from: process.env.MAIL_FROM || 'no-reply@example.com', ...message });
}

/**
 * Send an email without waiting for it: the response time doesn't reveal whether
 * an email was sent, and a delivery problem is logged instead of failing the request.
 */
export function sendMailInBackground(message: MailMessage): void {
  sendMail(message).catch((error: unknown) => {
    console.error(`Could not send the email "${message.subject}" to ${message.to}:`, error);
  });
}
