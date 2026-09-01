import type { RenderedEmail } from './layout.js';
import { renderLayout } from './layout.js';

export interface TaskAssignedInput {
  firmName: string;
  recipientName: string;
  taskTitle: string;
  clientName: string | null;
  dueDate: string | null;
  priority: string;
  assignedByName: string;
  taskUrl: string;
}

export const renderTaskAssigned = (input: TaskAssignedInput): RenderedEmail => {
  const blocks = [
    input.clientName ? `Client: ${input.clientName}` : 'This is internal firm work.',
    input.dueDate ? `Due: ${input.dueDate}` : 'No due date set.',
    `Priority: ${input.priority}`,
  ];
  const { html, text } = renderLayout({
    firmName: input.firmName,
    heading: input.taskTitle,
    intro: `${input.assignedByName} assigned this task to you.`,
    bodyBlocks: blocks,
    action: { label: 'Open the task', url: input.taskUrl },
    footerNote: 'You can switch off assignment emails in your FirmDesk profile.',
  });
  return { subject: `Task assigned: ${input.taskTitle}`, html, text };
};
