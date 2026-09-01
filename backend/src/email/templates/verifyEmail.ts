import type { RenderedEmail } from './layout.js';
import { renderLayout } from './layout.js';

export interface VerifyEmailInput {
  firmName: string;
  recipientName: string;
  verifyUrl: string;
}

export const renderVerifyEmail = (input: VerifyEmailInput): RenderedEmail => {
  const { html, text } = renderLayout({
    firmName: input.firmName,
    heading: 'Confirm your email address',
    intro: `Hello ${input.recipientName}, confirm this address so you can sign in to FirmDesk.`,
    bodyBlocks: [
      'This link works once and expires in 24 hours.',
      'If you did not create a FirmDesk account, ignore this message — nothing was set up in your name.',
    ],
    action: { label: 'Confirm email address', url: input.verifyUrl },
  });
  return { subject: 'Confirm your FirmDesk email address', html, text };
};
