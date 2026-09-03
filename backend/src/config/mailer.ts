import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { env, isTest } from './env.js';
import { logger } from './logger.js';

export type MailCategory =
  | 'verification'
  | 'password_reset'
  | 'assignment'
  | 'deadline_reminder'
  | 'daily_digest'
  | 'client_reminder';

export interface MailErrorDetails {
  errorCode?: string;
  smtpStatus?: number;
  smtpCommand?: string;
}

export const mailErrorDetails = (error: unknown): MailErrorDetails => {
  if (typeof error !== 'object' || error === null) return {};
  const source = error as Record<string, unknown>;
  const errorCode = typeof source.code === 'string' ? source.code : undefined;
  const smtpStatus =
    typeof source.responseCode === 'number' && Number.isInteger(source.responseCode)
      ? source.responseCode
      : undefined;
  const smtpCommand = typeof source.command === 'string' ? source.command : undefined;
  return { errorCode, smtpStatus, smtpCommand };
};

export interface OutboundMail {
  to: string;
  category: MailCategory;
  messageId: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailTransport {
  send: (mail: OutboundMail) => Promise<void>;
  verify: () => Promise<boolean>;
}

const captured: OutboundMail[] = [];

const memoryTransport: MailTransport = {
  send: async (mail) => {
    captured.push(mail);
    await Promise.resolve();
  },
  verify: async () => Promise.resolve(true),
};

export const capturedMail = (): readonly OutboundMail[] => captured;
export const clearCapturedMail = (): void => {
  captured.length = 0;
};

const buildSmtpTransport = (): MailTransport => {
  const transporter: Transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER !== undefined && env.SMTP_PASSWORD !== undefined
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
    pool: true,
    maxConnections: 3,
  });

  return {
    send: async (mail) => {
      await transporter.sendMail({
        from: env.MAIL_FROM,
        to: mail.to,
        messageId: mail.messageId,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    },
    verify: async () => {
      await transporter.verify();
      return true;
    },
  };
};

const buildConsoleTransport = (): MailTransport => ({
  send: async (mail) => {
    logger.info(
      {
        event: 'mail.dev_preview',
        to: mail.to,
        category: mail.category,
        subject: mail.subject,
      },
      `[DEV EMAIL] Outbound email to ${mail.to}: "${mail.subject}"`,
    );
    process.stdout.write(
      [
        '',
        '==================== DEVELOPMENT EMAIL PREVIEW ====================',
        `To: ${mail.to}`,
        `Subject: ${mail.subject}`,
        `Category: ${mail.category}`,
        '-------------------------------------------------------------------',
        mail.text,
        '===================================================================',
        '',
      ].join('\n'),
    );
    await Promise.resolve();
  },
  verify: async () => {
    logger.info(
      { event: 'mail.ready' },
      'development console mail transport active (emails printed to terminal)',
    );
    await Promise.resolve();
    return true;
  },
});

export const mailTransport: MailTransport = isTest
  ? memoryTransport
  : env.NODE_ENV === 'development' && env.SMTP_HOST.endsWith('.test')
    ? buildConsoleTransport()
    : buildSmtpTransport();

export const verifyMailTransport = async (): Promise<void> => {
  try {
    await mailTransport.verify();
    logger.info({ event: 'mail.ready' }, 'outbound mail transport verified');
  } catch (error) {
    logger.error(
      { event: 'mail.unavailable', ...mailErrorDetails(error) },
      'outbound mail transport could not be verified; email will fail until it is fixed',
    );
  }
};
