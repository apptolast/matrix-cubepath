import nodemailer from 'nodemailer';
import { logger } from './logger';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

/**
 * Sends a password reset email.
 * Returns `true` if the email was sent via SMTP.
 * Returns `false` if SMTP is not configured — in that case the reset URL is
 * logged at INFO level so the admin can retrieve it from the server logs
 * (e.g. via the Dokploy log panel).
 */
export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<boolean> {
  const appUrl = (process.env.APP_URL || 'http://localhost:3939').replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  const transport = createTransport();

  if (!transport) {
    // No SMTP configured — emit the link to the server log so the admin can use it
    logger.info('mailer', `[NO SMTP] Password reset URL for ${to}: ${resetUrl}`);
    return false;
  }

  const from = process.env.SMTP_FROM || 'Matrix <noreply@matrix.app>';

  await transport.sendMail({
    from,
    to,
    subject: 'Reset your Matrix password',
    text: [
      'You requested a password reset for your Matrix account.',
      '',
      `Reset link (expires in 1 hour):`,
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Reset your Matrix password</h2>
        <p>You requested a password reset for your account.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:10px 20px;background:#00ff41;color:#000;
                    text-decoration:none;border-radius:4px;font-weight:600">
            Reset password
          </a>
        </p>
        <p style="color:#888;font-size:13px">This link expires in 1 hour.</p>
        <p style="color:#888;font-size:13px">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  logger.info('mailer', `Password reset email sent to ${to}`);
  return true;
}
