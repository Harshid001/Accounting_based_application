import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, expect, it, beforeEach } from 'vitest';

import { AiChatDropdown } from '@/components/domain/AiChatDropdown';
import { sendAiChat } from '@/api/ai.api';

vi.mock('@/api/ai.api', () => ({
  sendAiChat: vi.fn(),
}));

vi.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    user: { name: 'Test User', email: 'test@firmdesk.in', role: 'staff', id: '123' },
  }),
}));

function renderDropdown() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AiChatDropdown />
    </MemoryRouter>,
  );
}

const mockReply = {
  content: '### Test Header\n\nThis is a **test** response with `code` and a bullet:\n• Item 1\n• Item 2',
  toolCalls: [{ tool: 'get_upcoming_deadlines', label: 'Checked 5 upcoming deadlines' }],
  actions: [{ label: 'View Statutory Filings', route: '/compliance' }],
  mode: 'fallback' as const,
};

describe('AiChatDropdown Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendAiChat).mockResolvedValue(mockReply);
  });

  it('renders the AI button in navigation bar', () => {
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.getByText(/Ask AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Copilot/i)).toBeInTheDocument();
  });

  it('opens big dropdown chat and displays greeting and prompt chips when clicked', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    expect(screen.getByText(/FirmDesk AI Copilot/i)).toBeInTheDocument();
    expect(screen.getByText(/CA Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/I am your/i)).toBeInTheDocument();

    expect(screen.getByText(/Upcoming Tax Deadlines/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending GST Filings/i)).toBeInTheDocument();
  });

  it('sends message to API and renders response with tool badges and action links', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    const input = screen.getByPlaceholderText(/Ask to create tasks/i);
    await user.type(input, 'What are the upcoming deadlines?{enter}');

    const header = await screen.findByText(/Test Header/i);
    expect(header).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Checked 5 upcoming deadlines/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/View Statutory Filings/i)).toBeInTheDocument();

    expect(sendAiChat).toHaveBeenCalledTimes(1);
    expect(sendAiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'What are the upcoming deadlines?',
      }),
    );
  });

  it('allows clicking quick prompt suggestions', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    const promptBtn = screen.getByRole('button', { name: /Pending GST Filings/i });
    await user.click(promptBtn);

    await waitFor(() => {
      expect(sendAiChat).toHaveBeenCalledTimes(1);
    });
    expect(sendAiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('GST filings'),
      }),
    );
  });

  it('renders markdown with bold, code, and bullet points', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    const input = screen.getByPlaceholderText(/Ask to create tasks/i);
    await user.type(input, 'test markdown{enter}');

    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument();
    });

    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('displays fallback mode notice when mode is fallback', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    const input = screen.getByPlaceholderText(/Ask to create tasks/i);
    await user.type(input, 'test{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Test Header/i)).toBeInTheDocument();
    });
  });

  it('allows expanding width and closing the relative sidebar', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    const sidebar = screen.getByTestId('ai-chat-sidebar');
    expect(sidebar).toBeInTheDocument();

    // Check expand button exists and works
    const expandBtn = screen.getByRole('button', { name: /Expand width/i });
    expect(expandBtn).toBeInTheDocument();
    await user.click(expandBtn);

    const collapseBtn = screen.getByRole('button', { name: /Collapse width/i });
    expect(collapseBtn).toBeInTheDocument();

    // Check close button
    const closeBtn = screen.getByRole('button', { name: /Close AI Chat/i });
    await user.click(closeBtn);

    expect(screen.queryByTestId('ai-chat-sidebar')).not.toBeInTheDocument();
  });

  it('resets conversation when reset button is clicked', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const triggerBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    await user.click(triggerBtn);

    const input = screen.getByPlaceholderText(/Ask to create tasks/i);
    await user.type(input, 'Hello{enter}');

    await screen.findByText(/Test Header/i);

    const resetBtn = screen.getByRole('button', { name: /Reset conversation/i });
    await user.click(resetBtn);

    expect(screen.queryByText(/Test Header/i)).not.toBeInTheDocument();
    expect(screen.getByText(/I am your/i)).toBeInTheDocument();
  });
});