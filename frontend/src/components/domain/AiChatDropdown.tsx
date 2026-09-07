import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { sendAiChat } from '@/api/ai.api';
import type { AttachedImageData } from '@/context/AiChatContext';
import { AiChatContext, AiChatProvider, useAiChat } from '@/context/AiChatContext';
import { useSession } from '@/context/SessionContext';
import { cn } from '@/lib/cn';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  image?: AttachedImageData | null;
  toolCalls?: Array<{ tool: string; label: string }>;
  actions?: Array<{ label: string; route: string }>;
}

const QUICK_PROMPTS = [
  {
    label: '🚀 Run Practice Automation (Option 1)',
    query:
      'Run comprehensive practice automation (Option 1): check deadlines, bulk generate filings, and schedule urgent review tasks.',
  },
  {
    label: '⚡ What can you automate?',
    query: 'What operations and workflows can you automate across the whole FirmDesk website?',
  },
  {
    label: '⚙️ Manage Client Services',
    query:
      'Show client statutory services and attach any missing GSTR-1, GSTR-3B, or TDS quarterly services.',
  },
  {
    label: '📅 Upcoming Tax Deadlines',
    query: 'What are the upcoming statutory tax deadlines for GST and TDS this month?',
  },
  {
    label: '📋 Pending GST Filings',
    query: 'Show pending GST filings and tell me what actions you can take on them.',
  },
  {
    label: '📝 Create Client Task',
    query: 'Create a high priority task to review client GST challans by this Friday.',
  },
  {
    label: '📊 Firm Workload Report',
    query: 'Show me the team workload report and pending tasks breakdown.',
  },
];

function formatCurrentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'code'; value: string };

type BlockNode =
  | { type: 'header'; level: number; children: InlineNode[] }
  | { type: 'bullet'; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] };

const parseInline = (str: string): InlineNode[] => {
  const result: InlineNode[] = [];
  let i = 0;
  let current = '';

  while (i < str.length) {
    const ch = str[i];
    if (ch === '*' && i + 1 < str.length && str[i + 1] === '*') {
      if (current) result.push({ type: 'text', value: current });
      current = '';
      i += 2;
      let boldText = '';
      while (i < str.length && !(str[i] === '*' && str[i + 1] === '*')) {
        boldText += str[i];
        i += 1;
      }
      result.push({ type: 'bold', children: [{ type: 'text', value: boldText }] });
      i += 2;
    } else if (ch === '`') {
      if (current) result.push({ type: 'text', value: current });
      current = '';
      i += 1;
      let codeText = '';
      while (i < str.length && str[i] !== '`') {
        codeText += str[i];
        i += 1;
      }
      result.push({ type: 'code', value: codeText });
      i += 1;
    } else if (ch === '_' && i + 1 < str.length && str[i + 1] === '_') {
      if (current) result.push({ type: 'text', value: current });
      current = '';
      i += 2;
      let italicText = '';
      while (i < str.length && !(str[i] === '_' && str[i + 1] === '_')) {
        italicText += str[i];
        i += 1;
      }
      result.push({ type: 'italic', children: [{ type: 'text', value: italicText }] });
      i += 2;
    } else {
      current += ch;
      i += 1;
    }
  }
  if (current) result.push({ type: 'text', value: current });
  return result;
};

const parseMarkdown = (text: string): BlockNode[] => {
  const lines = text.split('\n');
  const nodes: BlockNode[] = [];
  let currentParagraph: InlineNode[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      nodes.push({ type: 'paragraph', children: currentParagraph });
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      nodes.push({
        type: 'header',
        level: 3,
        children: parseInline(trimmed.slice(4)),
      });
    } else if (trimmed.startsWith('**') && trimmed.includes('**:')) {
      flushParagraph();
      const boldEnd = trimmed.indexOf('**:');
      const boldText = trimmed.slice(2, boldEnd);
      const rest = trimmed.slice(boldEnd + 3);
      const inlineList: InlineNode[] = [
        { type: 'bold', children: [{ type: 'text', value: boldText }] },
      ];
      if (rest.trim()) {
        inlineList.push(...parseInline(rest.trim()));
      }
      nodes.push({ type: 'paragraph', children: inlineList });
    } else if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      flushParagraph();
      nodes.push({ type: 'bullet', children: parseInline(trimmed.slice(2)) });
    } else if (trimmed === '') {
      flushParagraph();
    } else {
      currentParagraph.push(...parseInline(line));
    }
  }
  flushParagraph();
  return nodes;
};

const renderInlineNodes = (nodes: InlineNode[]): React.ReactNode =>
  nodes.map((node, idx) => {
    switch (node.type) {
      case 'bold':
        return (
          <strong key={idx} className="font-semibold">
            {renderInlineNodes(node.children)}
          </strong>
        );
      case 'italic':
        return <em key={idx}>{renderInlineNodes(node.children)}</em>;
      case 'code':
        return (
          <code
            key={idx}
            className="rounded bg-[var(--fd-surface-3)] px-1 py-0.5 text-[11px] font-mono text-indigo-600 dark:text-indigo-400"
          >
            {node.value}
          </code>
        );
      case 'text':
        return <span key={idx}>{node.value}</span>;
    }
  });

const renderMarkdown = (nodes: BlockNode[]): React.ReactNode => (
  <div className="space-y-2 font-sans leading-relaxed">
    {nodes.map((node, idx) => {
      switch (node.type) {
        case 'header':
          return (
            <h4 key={idx} className="font-semibold text-sm text-indigo-500 pt-1 pb-0.5">
              {renderInlineNodes(node.children)}
            </h4>
          );
        case 'paragraph':
          return (
            <p key={idx} className="leading-relaxed">
              {renderInlineNodes(node.children)}
            </p>
          );
        case 'bullet':
          return (
            <div key={idx} className="ml-3 flex items-start gap-2 leading-relaxed">
              <span className="text-indigo-500 shrink-0 select-none">•</span>
              <span>{renderInlineNodes(node.children)}</span>
            </div>
          );
      }
    })}
  </div>
);

/**
 * Topbar Trigger Button for the AI Copilot
 */
export function AiChatTrigger({ className }: { className?: string }) {
  const { isAiChatOpen, toggleAiChat } = useAiChat();

  return (
    <button
      type="button"
      onClick={toggleAiChat}
      aria-expanded={isAiChatOpen}
      aria-label="FirmDesk AI Assistant Chat"
      className={cn(
        'group relative inline-flex h-9 items-center gap-2 rounded-lg px-2.5 sm:px-3 text-xs font-semibold shadow-2xs transition-all cursor-pointer',
        'border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 hover:from-indigo-500/20 hover:via-purple-500/20 hover:to-pink-500/20',
        'text-[var(--fd-text-primary)] hover:border-indigo-500/50 hover:shadow-xs',
        'focus-visible:outline-2 focus-visible:outline-[var(--fd-focus-ring)]',
        isAiChatOpen && 'border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/20',
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-indigo-500 transition-transform group-hover:scale-110 group-hover:rotate-12 duration-300" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
        </span>
      </div>
      <span className="font-medium hidden sm:inline">Ask AI</span>
      <span className="hidden md:inline-flex items-center rounded-full bg-indigo-500/15 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
        Copilot
      </span>
    </button>
  );
}

/**
 * Relative AI Agent Sidebar docked alongside the workspace
 */
export function AiChatSidebar({ className }: { className?: string }) {
  const session = useSession();
  const userName = session.user?.name ?? 'there';
  const firstName = userName.split(' ')[0] ?? userName;

  const navigate = useNavigate();
  const {
    isAiChatOpen,
    closeAiChat,
    chatWidth,
    setChatWidth,
    isExpanded,
    toggleExpanded,
    pendingPrompt,
    clearPendingPrompt,
    pendingImage,
    clearPendingImage,
  } = useAiChat();

  const [input, setInput] = useState('');
  const normalizedPendingImage = pendingImage ?? null;
  const [attachedImage, setAttachedImage] = useState<AttachedImageData | null>(null);
  const [prevPendingImage, setPrevPendingImage] = useState<AttachedImageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  if (normalizedPendingImage !== prevPendingImage) {
    setPrevPendingImage(normalizedPendingImage);
    if (normalizedPendingImage && !pendingPrompt) {
      setAttachedImage(normalizedPendingImage);
    }
  }

  const msgIdRef = useRef(1);

  const initialMessages: ChatMessage[] = useMemo(
    () => [
      {
        id: 'welcome-msg',
        sender: 'assistant',
        content: `Hello ${firstName}! 👋 I am your **FirmDesk Autonomous Practice Copilot**.\n\nI can fully automate your practice workflows across the website: managing clients, tasks, statutory compliance filings (GST, TDS, ITR, MCA), bulk filing generation, document requests & reminders, client messaging, team workload, and firm reports.\n\nWhat would you like me to automate or help with today?`,
        timestamp: 'Just now',
      },
    ],
    [firstName],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage({
          dataUrl: reader.result,
          name: file.name || 'Pasted image',
          mimeType: file.type,
        });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFile(file);
            break;
          }
        }
      }
    },
    [handleImageFile],
  );

  const handleSend = useCallback(
    async (textToSend?: string, imageToSend?: AttachedImageData | null) => {
      const currentImage = imageToSend !== undefined ? imageToSend : attachedImage;
      const text = (textToSend ?? input).trim();
      if ((!text && !currentImage) || isTyping) return;

      msgIdRef.current += 1;
      const currentId = msgIdRef.current;
      const userMsg: ChatMessage = {
        id: `user-${currentId}`,
        sender: 'user',
        content: text || 'Please analyze this attached document or image and identify relevant details.',
        timestamp: formatCurrentTime(),
        image: currentImage,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setAttachedImage(null);
      setIsTyping(true);

      try {
        const history = messages
          .filter((m) => m.sender === 'user' || m.sender === 'assistant')
          .map((m) => ({ role: m.sender, content: m.content }));
        const route = window.location.pathname;
        const reply = await sendAiChat({
          message: text || 'Please analyze this attached document or image and identify relevant details.',
          history,
          currentRoute: route,
          image: currentImage ? { dataUrl: currentImage.dataUrl, mimeType: currentImage.mimeType } : null,
        });

        msgIdRef.current += 1;
        const aiId = msgIdRef.current;
        const aiMsg: ChatMessage = {
          id: `assistant-${aiId}`,
          sender: 'assistant',
          content: reply.content,
          timestamp: formatCurrentTime(),
          toolCalls: reply.toolCalls,
          actions: reply.actions,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errMsg: ChatMessage = {
          id: `error-${crypto.randomUUID()}`,
          sender: 'assistant',
          content: 'Sorry, I could not reach the AI service. Please try again in a moment.',
          timestamp: formatCurrentTime(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [attachedImage, input, isTyping, messages],
  );

  const handleClear = useCallback(() => {
    setMessages(initialMessages);
    setInput('');
    setAttachedImage(null);
  }, [initialMessages]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Focus input and scroll down when opened
  useEffect(() => {
    if (isAiChatOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isAiChatOpen]);

  // Handle incoming pending prompt & image
  useEffect(() => {
    if ((pendingPrompt || pendingImage) && isAiChatOpen) {
      if (pendingPrompt && pendingImage) {
        void handleSend(pendingPrompt, pendingImage);
        clearPendingPrompt();
        clearPendingImage();
      } else if (pendingPrompt) {
        void handleSend(pendingPrompt);
        clearPendingPrompt();
      } else if (pendingImage) {
        clearPendingImage();
      }
    }
  }, [pendingPrompt, pendingImage, isAiChatOpen, handleSend, clearPendingPrompt, clearPendingImage]);

  // Auto scroll on messages or typing changes
  useEffect(() => {
    if (isAiChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isAiChatOpen]);

  // Drag to resize sidebar relative to workspace
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragRef.current = { startX: e.clientX, startWidth: chatWidth };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - ev.clientX;
        setChatWidth(dragRef.current.startWidth + delta);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragRef.current = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [chatWidth, setChatWidth],
  );

  if (!isAiChatOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile Backdrop Overlay (only on mobile viewports < md) */}
      {isAiChatOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Dismiss AI overlay"
          className="md:hidden fixed inset-0 z-40 bg-[var(--fd-overlay)] backdrop-blur-xs transition-opacity animate-in fade-in duration-200 border-0 cursor-default"
          onClick={closeAiChat}
        />
      )}

      {/* Relative Sidebar Container */}
      <aside
        data-testid="ai-chat-sidebar"
        aria-label="FirmDesk AI Assistant Panel"
        onPaste={handlePaste}
        style={{ width: `${chatWidth}px` }}
        className={cn(
          'relative flex flex-col h-full shrink-0 border-l border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-xl z-20',
          isDragging ? 'transition-none select-none' : 'transition-[width] duration-300 ease-in-out',
          // Mobile responsive: converts to fixed drawer on mobile so narrow screens are not crushed
          'max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:w-full max-md:sm:w-[480px]',
          className,
        )}
      >
        {/* Left resize handle (desktop only) */}
        {isAiChatOpen && (
          <button
            type="button"
            aria-label="Resize AI sidebar"
            onMouseDown={handleMouseDown}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setChatWidth(chatWidth + 20);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setChatWidth(chatWidth - 20);
              }
            }}
            className={cn(
              'hidden md:block absolute left-0 top-0 bottom-0 w-2 -translate-x-1 cursor-col-resize z-30 transition-colors group p-0 border-0 bg-transparent',
              isDragging ? 'bg-indigo-500/40' : 'hover:bg-indigo-500/20',
            )}
            title="Drag or use Left/Right arrow keys to resize workspace & sidebar"
          >
            <span className="absolute top-1/2 left-0.5 -translate-y-1/2 w-1 h-8 rounded-full bg-[var(--fd-border-strong)] group-hover:bg-indigo-500 transition-colors" />
          </button>
        )}

        {/* Sidebar Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--fd-border-subtle)] bg-gradient-to-r from-[var(--fd-surface-2)] via-[var(--fd-surface-1)] to-[var(--fd-surface-2)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--fd-text-primary)]">
                  FirmDesk AI Copilot
                </span>
                <span className="rounded bg-indigo-500/15 px-1.5 py-0.2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  CA Assistant
                </span>
              </div>
              <p className="text-[11px] text-[var(--fd-text-tertiary)] flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online • Live Firm Data • GST, TDS, Compliance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleExpanded}
              title={isExpanded ? 'Collapse to standard width' : 'Expand to wide width'}
              aria-label={isExpanded ? 'Collapse width' : 'Expand width'}
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleClear}
              title="Reset conversation"
              aria-label="Reset conversation"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeAiChat}
              aria-label="Close AI Chat"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Suggestions Bar */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/50 px-3 py-2 sm:px-4 no-scrollbar">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--fd-text-tertiary)] pl-1">
            Suggestions:
          </span>
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(p.query)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] px-2.5 py-1 text-[11px] font-medium text-[var(--fd-text-secondary)] shadow-2xs transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Chat Messages Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3 text-xs leading-relaxed',
                  isUser ? 'justify-end' : 'justify-start',
                )}
              >
                {!isUser && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={cn(
                    'relative group max-w-[85%] rounded-2xl p-3.5 shadow-2xs transition-all',
                    isUser
                      ? 'rounded-tr-xs bg-indigo-600 text-white'
                      : 'rounded-tl-xs border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] text-[var(--fd-text-primary)]',
                  )}
                >
                  {/* Tool Badges */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {msg.toolCalls.map((tc, tIdx) => (
                        <span
                          key={tIdx}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                        >
                          <Zap className="h-2.5 w-2.5" />
                          <span>{tc.label}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Copy Button for Assistant message */}
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--fd-surface-3)] text-[var(--fd-text-tertiary)] hover:text-[var(--fd-text-primary)] cursor-pointer"
                      title="Copy text"
                      aria-label="Copy text"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}

                  {/* Attached Image for User Message */}
                  {msg.image && (
                    <div className="mb-2.5 overflow-hidden rounded-xl border border-white/25 bg-black/20 p-1">
                      <img
                        src={msg.image.dataUrl}
                        alt={msg.image.name || 'Attached document'}
                        className="max-h-48 w-full rounded-lg object-contain"
                      />
                      <div className="px-1.5 pt-1 text-[10px] text-indigo-100 flex items-center justify-between font-mono">
                        <span className="truncate max-w-[200px]">{msg.image.name || 'Pasted image'}</span>
                        <span className="text-[9px] opacity-80">📷 Visual</span>
                      </div>
                    </div>
                  )}

                  {/* Message Content - Markdown rendered */}
                  {renderMarkdown(parseMarkdown(msg.content))}

                  {/* Quick Action Navigation Chips */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[var(--fd-border-subtle)] flex flex-wrap gap-1.5">
                      {msg.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => {
                            void navigate(act.route);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--fd-surface-1)] border border-[var(--fd-border)] px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shadow-2xs hover:bg-[var(--fd-surface-3)] cursor-pointer"
                        >
                          <span>{act.label}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={cn(
                      'mt-1.5 text-[9px] text-right font-mono',
                      isUser ? 'text-indigo-200' : 'text-[var(--fd-text-tertiary)]',
                    )}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {isUser && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--fd-surface-3)] text-[var(--fd-text-secondary)] shadow-xs">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 text-xs justify-start items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl rounded-tl-xs border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-4 py-2.5 text-[var(--fd-text-secondary)] flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
                <span className="text-[11px] pl-1.5 text-[var(--fd-text-tertiary)] font-medium">
                  Copilot is thinking...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input Bar */}
        <div className="shrink-0 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/80 p-3 sm:p-4">
          {/* Attached Image Preview Chip */}
          {attachedImage && (
            <div className="mb-2.5 flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={attachedImage.dataUrl}
                  alt={attachedImage.name || 'Attached image'}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover border border-indigo-500/30 shadow-xs"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--fd-text-primary)]">
                    {attachedImage.name || 'Pasted Image'}
                  </div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Ready to send to AI Copilot
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                title="Remove attached image"
                aria-label="Remove image"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--fd-text-tertiary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageFile(file);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach an image or paste (Ctrl+V)"
              aria-label="Attach image"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] text-[var(--fd-text-tertiary)] shadow-2xs transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onPaste={handlePaste}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask to create tasks, update filings, search clients, or paste an image (Ctrl+V)..."
              className="flex-1 rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3.5 py-2.5 text-xs text-[var(--fd-text-primary)] placeholder-[var(--fd-text-tertiary)] shadow-2xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !attachedImage) || isTyping}
              aria-label="Send message"
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-semibold shadow-xs transition-all cursor-pointer',
                (input.trim() || attachedImage) && !isTyping
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-[var(--fd-surface-3)] text-[var(--fd-text-tertiary)] cursor-not-allowed opacity-60',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex items-center justify-between pt-1.5 px-1 text-[10px] text-[var(--fd-text-tertiary)]">
            <span>Press Enter ↵ to send • Paste images anytime</span>
            <span>FirmDesk Practice Copilot</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function StandaloneAiChat({ standalone = true }: { standalone?: boolean }) {
  return (
    <>
      <AiChatTrigger />
      {standalone && <AiChatSidebar />}
    </>
  );
}

/**
 * All-in-one export for backward compatibility & standalone test harness
 */
export function AiChatDropdown({ standalone = true }: { standalone?: boolean }) {
  const context = useContext(AiChatContext);
  if (!context) {
    return (
      <AiChatProvider>
        <StandaloneAiChat standalone={standalone} />
      </AiChatProvider>
    );
  }
  return <StandaloneAiChat standalone={standalone} />;
}