import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAiConfig, sendAiChat } from '@/api/ai.api';
import { AiChatTrigger } from '@/components/domain/AiChatDropdown';
import { AiAgentPage, getUserTextSize } from '@/routes/agent/AiAgentPage';

vi.mock('@/api/ai.api', () => ({
  sendAiChat: vi.fn(),
  fetchAiConfig: vi.fn(),
}));

vi.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    user: { name: 'Aditya Sharma', email: 'aditya@firmdesk.in', role: 'admin', id: 'usr-123' },
  }),
}));

const mockReply = {
  content:
    '### Plan Generated Successfully\n\nI scanned 42 client entities and identified **3 upcoming GSTR-3B filings** needing immediate batch drafting.',
  toolCalls: [
    { tool: 'plan_bulk_filings', label: 'Drafted 3 GSTR-3B batches' },
    { tool: 'schedule_audit_tasks', label: 'Assigned review to staff' },
  ],
  actions: [
    { label: 'View Statutory Filings', route: '/compliance' },
    { label: 'Open Day Book', route: '/books/day-book' },
  ],
  mode: 'llm' as const,
};

const mockConfig = {
  provider: 'gemini' as const,
  enabled: true,
  activeModel: 'gemini-2.5-flash',
  gemini: { keySet: true, model: 'gemini-2.5-flash' },
  openai: { keySet: false, model: '' },
  custom: { keySet: false, model: '', baseUrl: '' },
  hasKey: true,
  source: 'env' as const,
  configuredAt: '2026-03-01T00:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agent']}>
      <AiAgentPage />
    </MemoryRouter>,
  );
}

describe('Claude Code Autonomous AI Agent Simple Bar (/agent)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAiConfig).mockResolvedValue(mockConfig);
    vi.mocked(sendAiChat).mockResolvedValue(mockReply);
  });

  it('renders the clean simple bar and initial prompt input without codex sign', () => {
    renderPage();

    // The clean simple bar
    expect(
      screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('❯')).not.toBeInTheDocument();
  });

  it('triggers slash command popover menu when typing /', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, '/pl');

    // Slash menu popover should display matching commands
    await waitFor(() => {
      expect(screen.getByText(/Commands \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText('Practice Automation Planner')).toBeInTheDocument();
    });
  });

  it('executes /help command and renders CLI command manual', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, '/help{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Claude Code CLI Commands/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Shortcuts:/i)).toBeInTheDocument();
  });

  it('sends prompt, displays user turn, assistant reply, tool executions, and action links', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, 'Reconcile March GST returns{enter}');

    // User turn should appear
    expect(await screen.findByText('Reconcile March GST returns')).toBeInTheDocument();

    // API called
    await waitFor(() => {
      expect(sendAiChat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reconcile March GST returns',
        }),
      );
    });

    // Assistant reply rendered
    expect(await screen.findByText(/Plan Generated Successfully/i)).toBeInTheDocument();

    // Tool executions badges
    expect(screen.getByText('Drafted 3 GSTR-3B batches')).toBeInTheDocument();
    expect(screen.getByText('Assigned review to staff')).toBeInTheDocument();

    // Action links
    expect(screen.getByText('View Statutory Filings')).toBeInTheDocument();
    expect(screen.getByText('Open Day Book')).toBeInTheDocument();
  });

  it('clears terminal buffer when /clear command is executed', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, 'Hello world{enter}');

    expect(await screen.findByText('Hello world')).toBeInTheDocument();

    // Now clear
    await user.type(
      screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i),
      '/clear{enter}',
    );

    // Message cleared, back to clean simple bar
    await waitFor(() => {
      expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i),
      ).toBeInTheDocument();
    });
  });

  it('renders clean ChatGPT-style bar with attach button, mic, placeholder, and without search books / deep audit pills', () => {
    renderPage();

    // Circular attach (+) button
    expect(screen.getByTitle(/Attach document or image/i)).toBeInTheDocument();

    // Search Books & Deep Audit should be removed for a clean minimal bar
    expect(screen.queryByRole('button', { name: /Search Books/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deep Audit/i })).not.toBeInTheDocument();

    // Clean placeholder is set
    expect(
      screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i),
    ).toBeInTheDocument();

    // Voice Dictation (Mic) button
    expect(screen.getByTitle(/Dictate with voice/i)).toBeInTheDocument();

    // Circular Send button
    expect(screen.getByTitle(/Send message/i)).toBeInTheDocument();

    // ChatGPT disclaimer text
    expect(
      screen.getByText(
        /FirmDesk Copilot can make mistakes. Verify statutory filings and book entries/i,
      ),
    ).toBeInTheDocument();
  });

  it('keeps conversation body container decoupled from bottom bar height', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, 'Initial message{enter}');

    // Message stream should be visible
    expect(await screen.findByText('Initial message')).toBeInTheDocument();

    // The bottom bar wrapper is absolutely positioned at the bottom so typing multiline text does not push/shrink body
    const bottomBarWrapper = screen
      .getByPlaceholderText(/Ask Copilot anything/i)
      .closest('.absolute.bottom-0');
    expect(bottomBarWrapper).not.toBeNull();
    expect(bottomBarWrapper).toHaveClass('pointer-events-none');
  });

  it('allows attaching any document, photo, audio, or spreadsheet file with rich preview and sends to AI', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.accept).toBe('*/*');

    const mockFile = new File(['Col1,Col2\n100,200'], 'audit_march.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (
      this: FileReader,
    ) {
      Object.defineProperty(this, 'result', {
        value:
          'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,ZmFrZQ==',
        writable: true,
      });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Pre-send preview pill should appear with filename and category
    await waitFor(() => {
      expect(screen.getByText('audit_march.xlsx')).toBeInTheDocument();
      expect(screen.getByText(/spreadsheet/i)).toBeInTheDocument();
    });

    // Send with the attached spreadsheet
    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, 'Reconcile this file{enter}');

    // User message bubble should display file card with download link
    expect(await screen.findByText('Reconcile this file')).toBeInTheDocument();
    expect(screen.getByTitle(/Download audit_march.xlsx/i)).toBeInTheDocument();

    // Verify payload to API
    await waitFor(() => {
      expect(sendAiChat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reconcile this file',
          file: expect.objectContaining({
            name: 'audit_march.xlsx',
            category: 'spreadsheet',
          }),
        }),
      );
    });

    readSpy.mockRestore();
  });

  it('allows attaching audio files and renders playable audio player preview', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const mockAudioFile = new File(['fake audio stream'], 'client_instruction.mp3', {
      type: 'audio/mp3',
    });

    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (
      this: FileReader,
    ) {
      Object.defineProperty(this, 'result', {
        value: 'data:audio/mp3;base64,AAAA',
        writable: true,
      });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    fireEvent.change(fileInput, { target: { files: [mockAudioFile] } });

    // Should display audio file name, category, and audio element
    await waitFor(() => {
      expect(screen.getByText('client_instruction.mp3')).toBeInTheDocument();
      expect(screen.getByText(/audio/i)).toBeInTheDocument();
    });

    // Send the audio file
    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, 'Transcribe and execute instructions{enter}');

    // Message turn should show audio filename and player
    expect(await screen.findByText('Transcribe and execute instructions')).toBeInTheDocument();
    expect(screen.getByText('client_instruction.mp3')).toBeInTheDocument();

    await waitFor(() => {
      expect(sendAiChat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Transcribe and execute instructions',
          file: expect.objectContaining({
            name: 'client_instruction.mp3',
            category: 'audio',
          }),
        }),
      );
    });

    readSpy.mockRestore();
  });

  it('activates mic speech dictation and displays listening banner when clicked', async () => {
    const user = userEvent.setup();

    // Mock Web Speech API SpeechRecognition
    class MockSpeechRecognition {
      continuous = true;
      interimResults = true;
      lang = 'en-IN';
      onresult: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
    }
    const speechWindow = window as unknown as Record<string, unknown>;
    speechWindow.webkitSpeechRecognition = MockSpeechRecognition;

    renderPage();

    const micBtn = screen.getByTitle(/Dictate with voice or record audio/i);
    await user.click(micBtn);

    // Placeholder changes to Listening... and mic button transforms to Stop listening
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Listening\.\.\./i)).toBeInTheDocument();
      expect(screen.getByTitle('Stop listening')).toBeInTheDocument();
    });

    // Clicking Stop listening stops speech recognition and restores clean placeholder
    const stopBtn = screen.getByTitle('Stop listening');
    await user.click(stopBtn);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i),
      ).toBeInTheDocument();
      expect(screen.getByTitle(/Dictate with voice or record audio/i)).toBeInTheDocument();
    });

    delete speechWindow.webkitSpeechRecognition;
  });

  it('navigates when clicking AI Copilot trigger in the topbar without opening a sidebar', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AiChatTrigger />
      </MemoryRouter>,
    );

    const copilotBtn = screen.getByRole('button', { name: /FirmDesk AI Assistant Chat/i });
    expect(copilotBtn).toBeInTheDocument();
    await user.click(copilotBtn);

    // Should NOT render any sidebar on the page
    expect(screen.queryByTestId('ai-chat-sidebar')).not.toBeInTheDocument();
  });

  it('auto-adjusts font size and constrains user message bubble dimensions with word-wrap', async () => {
    // Helper unit checks for responsive sizing
    expect(getUserTextSize('hi')).toBe('text-[15px]');
    expect(getUserTextSize('Check GSTR-1 filings for March 2026')).toBe('text-[14px]');
    expect(getUserTextSize('A'.repeat(300))).toBe('text-[13.5px]');

    const user = userEvent.setup();
    renderPage();

    const longWord = 'a'.repeat(80);
    const textarea = screen.getByPlaceholderText(/Ask Copilot anything, or type \/ for commands/i);
    await user.type(textarea, `${longWord}{enter}`);

    const userBubble = await screen.findByText(longWord);
    expect(userBubble).toBeInTheDocument();

    // Check wrapping classes prevent horizontal blowout
    expect(userBubble).toHaveClass('break-words');
    const bubbleCard = userBubble.closest('.rounded-2xl');
    expect(bubbleCard).toHaveClass('break-words');

    // Check outer container limits width to max-w-xl so it stays on the right side of the screen
    const outerContainer = bubbleCard?.parentElement;
    expect(outerContainer).toHaveClass('lg:max-w-xl');
  });

  it('allows attaching and sending more than one PDF at a time with theme-aware styling', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.hasAttribute('multiple')).toBe(true);

    const pdf1 = new File(['%PDF-1.4 mock pdf 1 content'], 'statutory_audit.pdf', {
      type: 'application/pdf',
    });
    const pdf2 = new File(['%PDF-1.4 mock pdf 2 content'], 'gstr3b_return.pdf', {
      type: 'application/pdf',
    });

    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (
      this: FileReader,
    ) {
      Object.defineProperty(this, 'result', {
        value: 'data:application/pdf;base64,JVBERi0xLjQK',
        writable: true,
      });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    fireEvent.change(fileInput, { target: { files: [pdf1, pdf2] } });

    // Both PDFs should be visible in pre-send preview
    await waitFor(() => {
      expect(screen.getByText('statutory_audit.pdf')).toBeInTheDocument();
      expect(screen.getByText('gstr3b_return.pdf')).toBeInTheDocument();
      expect(screen.getByText(/Clear all \(2\)/i)).toBeInTheDocument();
    });

    // Send both PDFs without custom text - auto-prompt should describe both files
    const sendBtn = screen.getByTitle('Send message');
    await user.click(sendBtn);

    // Both PDFs should appear in the sent message bubble
    await waitFor(() => {
      expect(screen.getByTitle('Download statutory_audit.pdf')).toBeInTheDocument();
      expect(screen.getByTitle('Download gstr3b_return.pdf')).toBeInTheDocument();
    });

    // Verify theme classes on PDF card (theme-aware surface, border, and text; no hardcoded #14161f)
    const downloadStatutory = screen.getByTitle('Download statutory_audit.pdf');
    const pdfCard = downloadStatutory.closest('.group');
    expect(pdfCard).toHaveClass('bg-[var(--fd-surface-1)]');
    expect(pdfCard).toHaveClass('border-[var(--fd-border-subtle)]');
    expect(pdfCard).not.toHaveClass('bg-[#14161f]');

    // Verify payload sent to sendAiChat
    expect(sendAiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Inspect attached 2 PDF documents'),
        files: expect.arrayContaining([
          expect.objectContaining({ name: 'statutory_audit.pdf', category: 'pdf' }),
          expect.objectContaining({ name: 'gstr3b_return.pdf', category: 'pdf' }),
        ]),
      }),
    );

    readSpy.mockRestore();
  });
});
