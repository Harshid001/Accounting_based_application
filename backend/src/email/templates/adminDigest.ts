import type { RenderedEmail } from './layout.js';
import { renderLayout } from './layout.js';

export interface AdminDigestInput {
  firmName: string;
  recipientName: string;
  overdueCount: number;
  dueThisWeekCount: number;
  awaitingClientCount: number;
  openRequestCount: number;
  topOverdue: Array<{ clientName: string; complianceTypeName: string; dueDate: string }>;
  automationSuggestions?: Array<{
    clientName: string;
    complianceTypeName: string;
    dueDate: string;
    ready: boolean;
  }>;
  dashboardUrl: string;
}

export const renderAdminDigest = (input: AdminDigestInput): RenderedEmail => {
  const blocks = [
    `Overdue filings: ${input.overdueCount}`,
    `Due in the next seven days: ${input.dueThisWeekCount}`,
    `Waiting on a client: ${input.awaitingClientCount}`,
    `Open document requests: ${input.openRequestCount}`,
  ];
  if (input.topOverdue.length > 0) {
    blocks.push('Oldest overdue filings:');
    for (const row of input.topOverdue) {
      blocks.push(`${row.complianceTypeName} — ${row.clientName} — was due ${row.dueDate}`);
    }
  }
  if (input.automationSuggestions !== undefined && input.automationSuggestions.length > 0) {
    blocks.push('Ready for browser automation (AI agent can file these):');
    for (const row of input.automationSuggestions) {
      blocks.push(
        `${row.complianceTypeName} — ${row.clientName} — due ${row.dueDate} — ${
          row.ready ? 'preparation ready' : 'needs preparation first'
        }`,
      );
    }
  }
  const { html, text } = renderLayout({
    firmName: input.firmName,
    heading: 'Daily practice summary',
    intro: `Hello ${input.recipientName}, here is where the practice stands this morning.`,
    bodyBlocks: blocks,
    action: { label: 'Open the dashboard', url: input.dashboardUrl },
    footerNote: 'You can switch off the daily digest in your FirmDesk profile.',
  });
  return { subject: `Practice summary — ${input.overdueCount} overdue`, html, text };
};
