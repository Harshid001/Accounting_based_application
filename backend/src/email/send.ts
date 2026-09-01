import { randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { mailErrorDetails, mailTransport } from '../config/mailer.js';
import type { MailCategory, MailErrorDetails } from '../config/mailer.js';
import { stripHeaderInjection } from '../lib/identifiers.js';
import type { NotificationPreferences } from '../models/user.model.js';
import type { RenderedEmail } from './templates/layout.js';

const EMAIL_ADDRESS = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/;
const MAX_SEND_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 250;
const TRANSIENT_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ECONNECTION',
  'ECONNREFUSED',
  'ECONNRESET',
  'EDNS',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ESOCKET',
  'ETIMEDOUT',
]);

export type { MailCategory } from '../config/mailer.js';

const isTransientMailError = (details: MailErrorDetails): boolean => {
  if (details.errorCode === 'EAUTH') return false;
  if (details.smtpStatus !== undefined) {
    return details.smtpStatus >= 400 && details.smtpStatus < 500;
  }
  return details.errorCode !== undefined && TRANSIENT_NETWORK_CODES.has(details.errorCode);
};

const waitBeforeRetry = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const preferenceKeyFor = (category: MailCategory): keyof NotificationPreferences | null => {
  switch (category) {
    case 'assignment':
      return 'emailOnAssignment';
    case 'deadline_reminder':
      return 'emailDeadlineReminders';
    case 'daily_digest':
      return 'emailDailyDigest';
    default:
      return null;
  }
};

export const categoryIsAllowed = (
  category: MailCategory,
  preferences: NotificationPreferences | undefined,
): boolean => {
  const key = preferenceKeyFor(category);
  if (key === null) return true;
  if (!preferences) return true;
  return preferences[key];
};

export interface SendMailInput {
  to: string;
  category: MailCategory;
  rendered: RenderedEmail;
  preferences?: NotificationPreferences | undefined;
}

export const sendMail = async (input: SendMailInput): Promise<boolean> => {
  const address = stripHeaderInjection(input.to).toLowerCase();
  if (!EMAIL_ADDRESS.test(address)) {
    logger.warn(
      { event: 'mail.rejected', reason: 'address_invalid', category: input.category },
      'refused to send mail to an address that is not a single valid mailbox',
    );
    return false;
  }
  if (!categoryIsAllowed(input.category, input.preferences)) {
    logger.debug(
      { event: 'mail.skipped', reason: 'preference_off', category: input.category },
      'recipient has switched this email category off',
    );
    return false;
  }

  const subject = stripHeaderInjection(input.rendered.subject).slice(0, 200);
  const outbound = {
    to: address,
    category: input.category,
    messageId: `<${randomUUID()}@firmdesk.local>`,
    subject,
    html: input.rendered.html,
    text: input.rendered.text,
  };

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      await mailTransport.send(outbound);
      logger.info(
        { event: 'mail.sent', category: input.category, attempts: attempt },
        'outbound email sent',
      );
      return true;
    } catch (error) {
      const details = mailErrorDetails(error);
      const retryable = isTransientMailError(details);
      if (!retryable || attempt === MAX_SEND_ATTEMPTS) {
        logger.error(
          {
            event: 'mail.failed',
            category: input.category,
            attempts: attempt,
            retryable,
            ...details,
          },
          'outbound email could not be delivered',
        );
        return false;
      }

      const delayMs = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
      logger.warn(
        {
          event: 'mail.retry',
          category: input.category,
          failedAttempt: attempt,
          nextAttempt: attempt + 1,
          maxAttempts: MAX_SEND_ATTEMPTS,
          delayMs,
          ...details,
        },
        'temporary outbound email failure; retrying',
      );
      await waitBeforeRetry(delayMs);
    }
  }

  return false;
};

export const appLink = (path: string): string => {
  const base = env.APP_BASE_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
};
