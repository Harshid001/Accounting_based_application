import type { RenderedEmail } from './layout.js';
import { renderLayout } from './layout.js';

export interface DeadlineReminderRow {
  clientName: string;
  complianceTypeName: string;
  periodLabel: string;
  dueDate: string;
  daysRemaining: number;
}

export interface DeadlineReminderInput {
  firmName: string;
  recipientName: string;
  rows: DeadlineReminderRow[];
  workUrl: string;
}

const describe = (row: DeadlineReminderRow): string => {
  const when =
    row.daysRemaining === 0
      ? 'due today'
      : row.daysRemaining === 1
        ? 'due tomorrow'
        : `due in ${row.daysRemaining} days`;
  return `${row.complianceTypeName} — ${row.clientName} — ${row.periodLabel} — ${when} (${row.dueDate})`;
};

export const renderDeadlineReminder = (input: DeadlineReminderInput): RenderedEmail => {
  const { html, text } = renderLayout({
    firmName: input.firmName,
    heading: 'Filings approaching their deadline',
    intro: `Hello ${input.recipientName}, ${input.rows.length} ${input.rows.length === 1 ? 'filing you own is' : 'filings you own are'} coming due.`,
    bodyBlocks: input.rows.map(describe),
    action: { label: 'Open My Work', url: input.workUrl },
    footerNote: 'You can switch off deadline reminders in your FirmDesk profile.',
  });
  return {
    subject: `${input.rows.length} filing${input.rows.length === 1 ? '' : 's'} approaching a deadline`,
    html,
    text,
  };
};
