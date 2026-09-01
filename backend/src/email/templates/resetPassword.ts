import type { RenderedEmail } from './layout.js';
import { renderLayout } from './layout.js';

export interface ResetPasswordInput {
  firmName: string;
  recipientName: string;
  resetUrl: string;
}

export const renderResetPassword = (input: ResetPasswordInput): RenderedEmail => {
  const { html, text } = renderLayout({
    firmName: input.firmName,
    heading: 'Set a new password',
    intro: `Hello ${input.recipientName}, use the link below to choose a new FirmDesk password.`,
    bodyBlocks: [
      'This link works once and expires in 60 minutes.',
      'Choose at least 12 characters. A phrase you can remember beats a short password you cannot.',
      'If you did not ask for this, ignore the message — your current password still works.',
    ],
    action: { label: 'Set a new password', url: input.resetUrl },
    footerNote: 'Signing in again on every device is expected after a password change.',
  });
  return { subject: 'Set a new FirmDesk password', html, text };
};
