import type { RenderedEmail } from './layout.js';
import { renderLayout } from './layout.js';

export interface ClientRequestReminderInput {
  firmName: string;
  recipientName: string;
  clientName: string;
  requestTitle: string;
  requestDescription: string | null;
  dueDate: string | null;
  senderName: string;
  portalUrl: string;
}

export const renderClientRequestReminder = (
  input: ClientRequestReminderInput,
): RenderedEmail => {
  const blocks: string[] = [];
  if (input.requestDescription) blocks.push(input.requestDescription);
  blocks.push(
    input.dueDate
      ? `We would like this by ${input.dueDate}.`
      : 'There is no fixed date, but the sooner the better.',
  );
  blocks.push(`Account: ${input.clientName}`);
  blocks.push('You can upload the file straight from the FirmDesk portal — no reply needed.');

  const { html, text } = renderLayout({
    firmName: input.firmName,
    heading: input.requestTitle,
    intro: `Hello ${input.recipientName}, ${input.senderName} at ${input.firmName} is still waiting on this document.`,
    bodyBlocks: blocks,
    action: { label: 'Upload the document', url: input.portalUrl },
    footerNote: 'This reminder was sent by a person at your firm, not automatically.',
  });
  return { subject: `Still needed: ${input.requestTitle}`, html, text };
};
