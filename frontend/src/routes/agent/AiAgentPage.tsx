import {
  ArrowRight,
  ArrowUp,
  Copy,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Mic,
  Plus,
  RotateCcw,
  Square,
  Terminal,
  Volume2,
  X,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { sendAiChat } from '@/api/ai.api';
import type { AiAction, AiToolBadge } from '@/api/ai.api';
import { useAiChat } from '@/context/AiChatContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/cn';

export type FileCategory = 'image' | 'audio' | 'pdf' | 'spreadsheet' | 'document' | 'file';

export interface AttachedItem {
  dataUrl: string;
  name: string;
  size: number;
  type: string;
  category: FileCategory;
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: Array<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

export function getFileCategory(name: string, mimeType = ''): FileCategory {
  const type = mimeType.toLowerCase();
  const lowerName = name.toLowerCase();

  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|tiff?)$/i.test(lowerName)) {
    return 'image';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|webm|flac|wma)$/i.test(lowerName)) {
    return 'audio';
  }
  if (type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type.includes('csv') ||
    /\.(xlsx?|csv|tsv|ods)$/i.test(lowerName)
  ) {
    return 'spreadsheet';
  }
  if (
    type.includes('word') ||
    type.includes('document') ||
    type.includes('text/') ||
    /\.(docx?|txt|rtf|md|json|xml|odt)$/i.test(lowerName)
  ) {
    return 'document';
  }
  return 'file';
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function renderFileIcon(category: FileCategory, size = 16) {
  switch (category) {
    case 'image':
      return <ImageIcon size={size} className="shrink-0 text-purple-400" />;
    case 'audio':
      return <Volume2 size={size} className="shrink-0 text-amber-500 dark:text-amber-400" />;
    case 'pdf':
      return <FileText size={size} className="shrink-0 text-rose-600 dark:text-rose-400" />;
    case 'spreadsheet':
      return (
        <FileSpreadsheet size={size} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
      );
    case 'document':
      return <FileText size={size} className="shrink-0 text-blue-600 dark:text-blue-400" />;
    default:
      return <File size={size} className="shrink-0 text-[var(--fd-text-secondary)]" />;
  }
}

export function FileAttachmentCard({
  file,
  onRemove,
  compact = false,
}: {
  file: AttachedItem;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const isPdf = file.category === 'pdf';
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl shadow-sm transition-all duration-200 hover:shadow',
        'border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] hover:border-[var(--fd-border)]',
        isPdf && 'hover:border-rose-400/50 dark:hover:border-rose-500/40',
        compact ? 'w-full p-2' : 'w-full max-w-sm min-w-[240px] p-2.5',
      )}
    >
      {/* Icon with theme-aware container */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg transition-colors',
          compact ? 'h-8 w-8' : 'h-9 w-9',
          isPdf
            ? 'border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : file.category === 'spreadsheet'
              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : file.category === 'document'
                ? 'border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : file.category === 'audio'
                  ? 'border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-3)] text-[var(--fd-text-secondary)]',
        )}
      >
        {renderFileIcon(file.category, compact ? 16 : 18)}
      </div>

      {/* File Info */}
      <div className="min-w-0 flex-1 pr-1">
        <div
          className="truncate text-xs font-medium text-[var(--fd-text-primary)]"
          title={file.name}
        >
          {file.name}
        </div>
        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-[var(--fd-text-tertiary)]">
          <span
            className={cn(
              'text-[10px] font-semibold tracking-wider uppercase',
              isPdf
                ? 'font-bold text-rose-600 dark:text-rose-400'
                : 'text-[var(--fd-text-secondary)]',
            )}
          >
            {file.category}
          </span>
          <span>•</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
      </div>

      {/* Action: Download or Remove */}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          title={`Remove ${file.name}`}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-rose-500"
        >
          <X size={15} />
        </button>
      ) : (
        <a
          href={file.dataUrl}
          download={file.name}
          title={`Download ${file.name}`}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]"
        >
          <Download size={15} />
        </a>
      )}
    </div>
  );
}

export function getUserTextSize(content: string): string {
  const text = content.trim();
  if (text.length <= 25 && !text.includes('\n')) {
    return 'text-[15px]';
  }
  if (text.length > 250) {
    return 'text-[13.5px]';
  }
  return 'text-[14px]';
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  image?: { dataUrl: string; name?: string } | null;
  file?: AttachedItem | null;
  files?: AttachedItem[] | null;
  toolCalls?: AiToolBadge[];
  actions?: AiAction[];
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  prompt: string;
}

const AudioAttachmentPlayer = ({ src, name, className }: { src: string; name: string; className: string }) => (
  <audio controls src={src} className={className} aria-label={`Play ${name}`}>
    <track default kind="captions" src="" srcLang="en" label="Captions unavailable" />
  </audio>
);

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/plan',
    label: 'Practice Automation Planner',
    description: 'Autonomous scan of all deadlines, pending filings, and review tasks',
    prompt:
      'Run comprehensive practice automation (Option 1): inspect client deadlines, bulk generate pending GST/TDS filings, and schedule urgent review tasks.',
  },
  {
    command: '/gst',
    label: 'GST Reconciliation & Filings',
    description: 'Check GSTR-1, GSTR-3B filings and flag mismatch with books',
    prompt:
      'Audit all upcoming GST filings for this month. Check which returns are unfiled, reconcile pending invoices, and draft filing batches.',
  },
  {
    command: '/filings',
    label: 'Bulk Generate Filings',
    description: 'Bulk create GSTR-1, GSTR-3B, TDS 26Q and ITR compliance items',
    prompt:
      'Plan and bulk generate statutory compliance filings for all active clients for the current quarter.',
  },
  {
    command: '/tasks',
    label: 'Workload & Task Balance',
    description: 'Rebalance pending tasks across staff and flag bottleneck items',
    prompt:
      'Analyze staff workload distribution, show pending high priority tasks, and recommend workload rebalancing.',
  },
  {
    command: '/docs',
    label: 'Missing Documents Chaser',
    description: 'Detect missing client vouchers and issue automated reminder requests',
    prompt:
      'Identify all clients with pending document requests for tax filings and dispatch automated WhatsApp/email reminders.',
  },
  {
    command: '/books',
    label: 'Day Book & Tally Sync Audit',
    description: 'Verify books status, vouchers balance, and Tally desktop bridge health',
    prompt:
      'Check accounting books status, verify Day Book voucher counts, and test Tally desktop integration connection.',
  },
  {
    command: '/doctor',
    label: 'Practice AI Diagnostic',
    description: 'Check AI engine keys, model health, database connection and portal bots',
    prompt:
      'Run a complete system diagnostic on the practice management engine: verify AI provider configuration, portal bot readiness, and database integrity.',
  },
  {
    command: '/clear',
    label: 'Clear Buffer',
    description: 'Reset session and return to empty prompt bar',
    prompt: '',
  },
  {
    command: '/help',
    label: 'CLI Command Manual',
    description: 'Display all keyboard shortcuts and slash commands',
    prompt: '',
  },
];

function formatTimeNow(): string {
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
  | { type: 'codeblock'; code: string; lang?: string }
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
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let codeBlockLang = '';

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      nodes.push({ type: 'paragraph', children: currentParagraph });
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        nodes.push({
          type: 'codeblock',
          code: codeBlockBuffer.join('\n'),
          lang: codeBlockLang,
        });
        codeBlockBuffer = [];
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      nodes.push({
        type: 'header',
        level: 3,
        children: parseInline(trimmed.slice(4)),
      });
    } else if (trimmed.startsWith('## ')) {
      flushParagraph();
      nodes.push({
        type: 'header',
        level: 2,
        children: parseInline(trimmed.slice(3)),
      });
    } else if (trimmed.startsWith('# ')) {
      flushParagraph();
      nodes.push({
        type: 'header',
        level: 1,
        children: parseInline(trimmed.slice(2)),
      });
    } else if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      nodes.push({ type: 'bullet', children: parseInline(trimmed.slice(2)) });
    } else if (trimmed === '') {
      flushParagraph();
    } else {
      currentParagraph.push(...parseInline(line));
    }
  }

  if (inCodeBlock && codeBlockBuffer.length > 0) {
    nodes.push({
      type: 'codeblock',
      code: codeBlockBuffer.join('\n'),
      lang: codeBlockLang,
    });
  }
  flushParagraph();
  return nodes;
};

const renderInlineNodes = (nodes: InlineNode[]): React.ReactNode =>
  nodes.map((node, idx) => {
    switch (node.type) {
      case 'bold':
        return (
          <strong key={idx} className="font-semibold text-[var(--fd-text-primary)]">
            {renderInlineNodes(node.children)}
          </strong>
        );
      case 'italic':
        return (
          <em key={idx} className="text-[var(--fd-text-secondary)] italic">
            {renderInlineNodes(node.children)}
          </em>
        );
      case 'code':
        return (
          <code
            key={idx}
            className="rounded border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--fd-text-primary)] dark:border-[#303030] dark:bg-[#212121] dark:text-[#ececec]"
          >
            {node.value}
          </code>
        );
      case 'text':
        return <span key={idx}>{node.value}</span>;
    }
  });

const renderMarkdown = (nodes: BlockNode[]): React.ReactNode => (
  <div className="space-y-2.5 text-[14px] leading-relaxed text-[var(--fd-text-secondary)]">
    {nodes.map((node, idx) => {
      switch (node.type) {
        case 'header':
          return (
            <div
              key={idx}
              className="flex items-center gap-2 border-b border-[var(--fd-border-subtle)] pt-2 pb-1 text-base font-semibold text-[var(--fd-text-primary)]"
            >
              <span>{renderInlineNodes(node.children)}</span>
            </div>
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
              <span className="text-[var(--fd-text-tertiary)] select-none">•</span>
              <span>{renderInlineNodes(node.children)}</span>
            </div>
          );
        case 'codeblock':
          return (
            <div
              key={idx}
              className="my-3 overflow-hidden rounded-xl border border-[var(--fd-border-subtle)] bg-black shadow-md dark:border-[#303030]"
            >
              <div className="flex items-center justify-between border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3.5 py-1.5 text-[11px] text-[var(--fd-text-secondary)] select-none dark:border-[#303030] dark:bg-[#212121]">
                <span className="font-mono text-[10px] tracking-wider text-[var(--fd-text-tertiary)] uppercase">
                  {node.lang || 'code'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(node.code);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] transition-colors hover:text-[var(--fd-text-primary)] dark:hover:text-white"
                >
                  <Copy size={12} />
                  <span>Copy code</span>
                </button>
              </div>
              <pre className="overflow-x-auto bg-[#000000] p-3.5 font-mono text-[12px] leading-relaxed text-[#ececec]">
                <code>{node.code}</code>
              </pre>
            </div>
          );
      }
    })}
  </div>
);

export function AiAgentPage() {
  usePageTitle('Claude Code • AI Copilot');
  const { pendingPrompt, clearPendingPrompt, pendingImage, clearPendingImage } = useAiChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedItem[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // ChatGPT Bar Features: Speech Recognition & Cancel
  const [isListening, setIsListening] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgIdCounter = useRef(1);

  // Auto-focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-expand textarea dynamically like ChatGPT
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = input.trim()
        ? `${Math.min(Math.max(scrollH, 24), 160)}px`
        : '24px';
    }
  }, [input]);

  // Clean up audio / speech resources on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          recognitionRef.current = null;
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          mediaRecorderRef.current = null;
        }
      }
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
      }
    };
  }, []);

  // Voice Note Recording fallback/option via MediaRecorder
  const startVoiceRecording = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Audio recording is not supported in this browser environment.');
      return;
    }
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        setVoiceDuration(0);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const mime = recorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mime });
          stream.getTracks().forEach((track) => track.stop());

          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              const now = new Date();
              const pad = (n: number) => n.toString().padStart(2, '0');
              const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
              setAttachedFiles((prev) => [
                ...prev,
                {
                  dataUrl: reader.result as string,
                  name: `voice_note_${timeStr}.webm`,
                  size: blob.size,
                  type: mime,
                  category: 'audio',
                },
              ]);
            }
          };
          reader.readAsDataURL(blob);
          setIsRecordingVoice(false);
          if (voiceTimerRef.current) {
            clearInterval(voiceTimerRef.current);
          }
        };

        recorder.start();
        setIsRecordingVoice(true);
        voiceTimerRef.current = setInterval(() => {
          setVoiceDuration((prev) => prev + 1);
        }, 1000);
      })
      .catch(() => {
        alert('Microphone permission was denied or is not accessible.');
        setIsRecordingVoice(false);
      });
  }, []);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        mediaRecorderRef.current = null;
      }
    }
    setIsRecordingVoice(false);
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
    }
  }, []);

  // Voice Dictation (Speech to Text) like ChatGPT Mic, with graceful fallback to Voice Note recording
  const toggleSpeechRecognition = useCallback(() => {
    if (isRecordingVoice) {
      stopVoiceRecording();
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      // Gracefully fallback to recording an audio note using microphone!
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function'
      ) {
        startVoiceRecording();
        return;
      }
      alert(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Brave.',
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i]?.[0];
          if (result !== undefined) transcript += result.transcript;
        }
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function'
      ) {
        startVoiceRecording();
      } else {
        setIsListening(false);
      }
    }
  }, [isListening, isRecordingVoice, startVoiceRecording, stopVoiceRecording]);

  // Stop Generating like ChatGPT Stop button
  const handleStopExecution = useCallback(() => {
    isCancelledRef.current = true;
    setIsExecuting(false);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExecuting]);

  // Universal file handler for multiple documents, PDFs, photos, audio, spreadsheets, and files
  const handleAnyFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    fileArray.forEach((file) => {
      if (file.size > 50 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 50MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const category = getFileCategory(file.name, file.type);
          setAttachedFiles((prev) => [
            ...prev,
            {
              dataUrl: reader.result as string,
              name: file.name || `attachment_${Date.now()}`,
              size: file.size,
              type: file.type || 'application/octet-stream',
              category,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    setInput('');
    setAttachedFiles([]);
    setShowSlashMenu(false);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    if (isRecordingVoice) {
      stopVoiceRecording();
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isListening, isRecordingVoice, stopVoiceRecording]);

  const handleHelp = useCallback(() => {
    msgIdCounter.current += 1;
    const helpMsg: ChatMessage = {
      id: `help-${msgIdCounter.current}`,
      sender: 'assistant',
      content: `### Claude Code CLI Commands\n\n- **/plan** — Run end-to-end practice automation planner\n- **/gst** — Audit upcoming GST returns, reconcile 2B discrepancies\n- **/filings** — Bulk generate statutory returns for clients\n- **/tasks** — Balance staff workloads & schedule priority reviews\n- **/docs** — Audit missing vouchers and trigger reminder requests\n- **/books** — Inspect Day Book balance & test Tally connector\n- **/doctor** — Run practice environment and AI diagnostic check\n- **/clear** — Reset the terminal session and return to prompt bar\n- **/help** — Show this command list\n\n**Shortcuts:** \`Enter\` run • \`Shift+Enter\` newline • \`Tab\` autocomplete • \`Esc\` close`,
      timestamp: formatTimeNow(),
    };
    setMessages((prev) => [...prev, helpMsg]);
  }, []);

  const filteredSlashCommands = useMemo(() => {
    if (!showSlashMenu) return [];
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(slashFilter.toLowerCase()) ||
        cmd.label.toLowerCase().includes(slashFilter.toLowerCase()),
    );
  }, [showSlashMenu, slashFilter]);

  const executeCommand = useCallback(
    async (
      textToRun: string,
      filesToSend?: AttachedItem[] | AttachedItem | null,
      imgToSend?: { dataUrl: string; name?: string } | null,
    ) => {
      const text = textToRun.trim();
      let currentFiles: AttachedItem[];
      if (filesToSend !== undefined && filesToSend !== null) {
        currentFiles = Array.isArray(filesToSend) ? filesToSend : [filesToSend];
      } else if (imgToSend) {
        currentFiles = [
          {
            dataUrl: imgToSend.dataUrl,
            name: imgToSend.name || 'document.png',
            size: 0,
            type: 'image/png',
            category: 'image',
          },
        ];
      } else {
        currentFiles = [...attachedFiles];
      }

      if (!text && currentFiles.length === 0) return;

      if (text === '/clear') {
        handleClear();
        return;
      }
      if (text === '/help') {
        handleHelp();
        return;
      }

      isCancelledRef.current = false;
      let textToSend = text;
      if (!textToSend && currentFiles.length > 0) {
        const allPdfs = currentFiles.every((f) => f.category === 'pdf');
        const allImages = currentFiles.every((f) => f.category === 'image');
        const allSpreadsheets = currentFiles.every((f) => f.category === 'spreadsheet');

        if (allPdfs) {
          textToSend =
            currentFiles.length === 1
              ? 'Inspect attached PDF document for statutory compliance, invoices, and vouchers.'
              : `Inspect attached ${currentFiles.length} PDF documents (${currentFiles.map((f) => f.name).join(', ')}) for statutory compliance, invoices, and vouchers.`;
        } else if (allImages) {
          textToSend =
            currentFiles.length === 1
              ? 'Analyze attached photo/image for accounting details.'
              : `Analyze attached ${currentFiles.length} photos/images for accounting details.`;
        } else if (allSpreadsheets) {
          textToSend =
            currentFiles.length === 1
              ? 'Audit and analyze this spreadsheet data for compliance and book balance.'
              : `Audit and analyze these ${currentFiles.length} spreadsheets for compliance and book balance.`;
        } else {
          const firstCurrentFile = currentFiles[0];
          textToSend =
            currentFiles.length === 1 && firstCurrentFile
              ? firstCurrentFile.category === 'audio'
                ? 'Listen to and analyze this audio recording for accounting instructions.'
                : firstCurrentFile.category === 'document'
                  ? 'Review attached document for accounting records and notes.'
                  : 'Analyze attached file for accounting workflow.'
              : `Inspect attached ${currentFiles.length} files (${currentFiles.map((f) => f.name).join(', ')}) for accounting records, invoices, and statutory compliance.`;
        }
      }

      const firstImage = currentFiles.find(
        (f) => f.category === 'image' || f.type.startsWith('image/'),
      );

      msgIdCounter.current += 1;
      const userMsg: ChatMessage = {
        id: `user-${msgIdCounter.current}`,
        sender: 'user',
        content: text || textToSend,
        timestamp: formatTimeNow(),
        files: currentFiles,
        file: currentFiles[0] || null,
        image: firstImage ? { dataUrl: firstImage.dataUrl, name: firstImage.name } : null,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setAttachedFiles([]);
      setShowSlashMenu(false);
      setIsExecuting(true);

      try {
        const history = messages
          .filter((m) => m.sender === 'user' || m.sender === 'assistant')
          .map((m) => ({ role: m.sender as 'user' | 'assistant', content: m.content }));

        const reply = await sendAiChat({
          message: textToSend,
          history,
          currentRoute: window.location.pathname,
          image: firstImage ? { dataUrl: firstImage.dataUrl, mimeType: firstImage.type } : null,
          file: currentFiles[0]
            ? {
                dataUrl: currentFiles[0].dataUrl,
                name: currentFiles[0].name,
                size: currentFiles[0].size,
                mimeType: currentFiles[0].type,
                category: currentFiles[0].category,
              }
            : null,
          files: currentFiles.map((f) => ({
            dataUrl: f.dataUrl,
            name: f.name,
            size: f.size,
            mimeType: f.type,
            category: f.category,
          })),
        });

        if (isCancelledRef.current) return;

        msgIdCounter.current += 1;
        const aiMsg: ChatMessage = {
          id: `assistant-${msgIdCounter.current}`,
          sender: 'assistant',
          content: reply.content,
          timestamp: formatTimeNow(),
          toolCalls: reply.toolCalls,
          actions: reply.actions,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        if (isCancelledRef.current) return;
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          content: `⚠️ **Autonomous Execution Error**: Unable to reach AI agent service. Please verify configuration in **/settings/ai**.`,
          timestamp: formatTimeNow(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsExecuting(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    },
    [attachedFiles, handleClear, handleHelp, messages],
  );

  useEffect(() => {
    if (pendingPrompt || pendingImage) {
      const promptToRun = pendingPrompt || '';
      const img = pendingImage ? { dataUrl: pendingImage.dataUrl, name: pendingImage.name } : null;
      clearPendingPrompt();
      clearPendingImage();
      if (promptToRun || img) {
        queueMicrotask(() => void executeCommand(promptToRun, null, img));
      }
    }
  }, [pendingPrompt, pendingImage, clearPendingPrompt, clearPendingImage, executeCommand]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(
          (prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSlashCommands[slashSelectedIndex];
        if (selected) {
          if (selected.prompt) {
            void executeCommand(selected.prompt);
          } else {
            void executeCommand(selected.command);
          }
        }
        setShowSlashMenu(false);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void executeCommand(input);
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(val);
      setSlashSelectedIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (cmd: SlashCommand) => {
    if (cmd.prompt) {
      void executeCommand(cmd.prompt);
    } else {
      void executeCommand(cmd.command);
    }
    setShowSlashMenu(false);
  };

  const isBlank = messages.length === 0;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--fd-bg)] text-[var(--fd-text-primary)] select-text dark:bg-[#000000]">
      {/* Messages Stream / Agent Body (Directly on page, covers the whole page) */}
      {!isBlank && (
        <div className="z-10 flex flex-shrink-0 items-center justify-between border-b border-[var(--fd-border-subtle)] bg-[var(--fd-bg)] px-6 py-2.5 text-xs text-[var(--fd-text-tertiary)] dark:border-[#212121] dark:bg-[#000000]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--fd-text-primary)]">AI Copilot</span>
            <span className="text-[var(--fd-text-tertiary)]">~/firmdesk/practice</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            title="Reset session"
            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[#fb7185] dark:hover:bg-[#262626]"
          >
            <RotateCcw size={12} />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Scrollable Conversation Stream - Constant Full Height */}
      {!isBlank && (
        <div className="min-h-0 w-full flex-1 space-y-5 overflow-x-hidden overflow-y-auto scroll-smooth px-6 pt-4">
          {messages.map((msg) => (
            <div key={msg.id} className="message-enter space-y-2">
              {/* User Message (Right Side of Page with Auto-Adjusting Size) */}
              {msg.sender === 'user' && (
                <div className="ml-auto flex w-fit max-w-[85%] flex-col items-end py-1 pr-5 sm:max-w-[70%] md:max-w-lg lg:max-w-xl">
                  <div
                    className={cn(
                      'w-fit max-w-full rounded-2xl rounded-br-sm border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-4 py-2.5 [overflow-wrap:anywhere] break-words [word-break:break-word] text-[var(--fd-text-primary)] shadow-sm transition-all duration-200 hover:border-[var(--fd-border)] hover:shadow-md dark:border-[#303030] dark:bg-[#212121] dark:text-[#ececec] dark:hover:border-[#424242]',
                      getUserTextSize(msg.content),
                    )}
                  >
                    <div className="leading-relaxed [overflow-wrap:anywhere] break-words [word-break:break-word] whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* Rich Attached Files Display (PDFs, Documents, Spreadsheets, Audio, Photos) */}
                    {((msg.files && msg.files.length > 0) || msg.file) && (
                      <div className="pt-2.5">
                        {(() => {
                          const filesToRender =
                            msg.files && msg.files.length > 0
                              ? msg.files
                              : msg.file
                                ? [msg.file]
                                : [];

                          const singleFile = filesToRender.length === 1 ? filesToRender[0] : null;

                          // Single image attachment view
                          if (singleFile && singleFile.category === 'image') {
                            const imgFile = singleFile;
                            return (
                              <div className="space-y-1">
                                <img
                                  src={imgFile.dataUrl}
                                  alt={imgFile.name}
                                  className="max-h-56 max-w-xs rounded-xl border border-[var(--fd-border-subtle)] object-cover shadow-md sm:max-w-sm dark:border-[#303030]"
                                />
                                <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-[var(--fd-text-tertiary)]">
                                  <ImageIcon size={12} className="text-purple-400" />
                                  <span className="max-w-[200px] truncate">{imgFile.name}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(imgFile.size)}</span>
                                </div>
                              </div>
                            );
                          }

                          // Single audio attachment view
                          if (singleFile && singleFile.category === 'audio') {
                            const audFile = singleFile;
                            return (
                              <div className="w-full max-w-sm min-w-[260px] rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3 shadow-md dark:border-[#2f2f2f] dark:bg-[#181818]">
                                <div className="mb-2 flex items-center gap-2">
                                  <Volume2
                                    size={16}
                                    className="shrink-0 text-amber-500 dark:text-amber-400"
                                  />
                                  <span className="max-w-[180px] truncate text-xs font-medium text-[var(--fd-text-primary)] dark:text-[#ececec]">
                                    {audFile.name}
                                  </span>
                                  <span className="ml-auto text-[10px] text-[var(--fd-text-tertiary)]">
                                    {formatFileSize(audFile.size)}
                                  </span>
                                </div>
                                <AudioAttachmentPlayer src={audFile.dataUrl} name={audFile.name} className="h-8 w-full rounded" />
                              </div>
                            );
                          }

                          // Multiple files or PDF/Document/Spreadsheet cards (Theme-aware styled!)
                          return (
                            <div
                              className={cn(
                                'w-full max-w-full gap-2 pt-0.5',
                                filesToRender.length > 1
                                  ? 'grid grid-cols-1 sm:grid-cols-2'
                                  : 'flex flex-col',
                              )}
                            >
                              {filesToRender.map((fileItem, fIdx) => (
                                <FileAttachmentCard
                                  key={`${fileItem.name}-${fIdx}`}
                                  file={fileItem}
                                  compact={filesToRender.length > 1}
                                />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Legacy fallback if msg.image only */}
                    {!msg.file && (!msg.files || msg.files.length === 0) && msg.image && (
                      <div className="pt-2">
                        <img
                          src={msg.image.dataUrl}
                          alt="Document"
                          className="max-h-48 max-w-xs rounded-lg border border-[var(--fd-border-subtle)] object-cover shadow-sm dark:border-[#303030]"
                        />
                      </div>
                    )}
                  </div>
                  <span className="pt-1 pr-1.5 text-[10px] text-[var(--fd-text-tertiary)] select-none">
                    {msg.timestamp}
                  </span>
                </div>
              )}

              {/* Assistant Message */}
              {msg.sender === 'assistant' && (
                <div className="max-w-full space-y-3 overflow-hidden pt-1 pr-5 pl-5 text-[13px] [overflow-wrap:anywhere] break-words">
                  {/* Tool Execution Badges */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {msg.toolCalls.map((tool, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] px-2 py-0.5 text-[11px] text-[#38bdf8] dark:border-[#2e2e2e] dark:bg-[#181818]"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                          <span>{tool.label || tool.tool}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Markdown Content */}
                  <div className="leading-relaxed">
                    {renderMarkdown(parseMarkdown(msg.content))}
                  </div>

                  {/* Action Chips */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {msg.actions.map((act, aIdx) => (
                        <Link
                          key={aIdx}
                          to={act.route}
                          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#da7756]/30 bg-[#da7756]/15 px-3 py-1 text-xs font-medium text-[#da7756] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#da7756]/25 hover:text-[#ff8a1f] hover:shadow-xs active:translate-y-0"
                        >
                          <span>{act.label}</span>
                          <ArrowRight
                            size={12}
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Live Executing Indicator */}
          {isExecuting && (
            <div className="flex animate-pulse items-center gap-2 pl-5 text-xs text-[var(--fd-text-secondary)]">
              <span className="text-base select-none">✻</span>
              <span>Thinking & executing...</span>
            </div>
          )}

          {/* Bottom Buffer Spacer so conversation scrolls clear of the bottom floating bar */}
          <div className="pointer-events-none h-60 flex-shrink-0" aria-hidden="true" />
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Centered Welcome Hero when Conversation is Blank */}
      {isBlank && (
        <div className="flex min-h-0 flex-1 fade-up flex-col items-center justify-center overflow-y-auto px-4 pb-32 text-center">
          <div className="group relative mb-4 cursor-default">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--fd-border)] bg-gradient-to-tr from-[var(--fd-accent)]/20 via-[var(--fd-surface-2)] to-[var(--fd-surface-3)] shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:border-[var(--fd-accent)]/50">
              <Terminal
                size={26}
                className="text-[var(--fd-accent)] transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--fd-accent)] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--fd-accent)]" />
            </span>
          </div>

          <h2 className="mb-2 text-xl font-semibold tracking-tight text-[var(--fd-text-primary)] sm:text-2xl">
            What can I help you audit or file today?
          </h2>
          <p className="mb-6 max-w-md text-xs leading-relaxed text-[var(--fd-text-secondary)] sm:text-sm">
            Ask questions, attach documents or files, or run practice automations.
          </p>

          {/* Quick Starter Chips */}
          <div className="grid w-full max-w-lg grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
            {[
              {
                title: 'Reconcile GST 2B',
                desc: 'Scan recent purchases vs GSTR-2B discrepancy',
                prompt: '/gst',
              },
              {
                title: 'Balance Day Book',
                desc: 'Verify ledger debit/credit balances in Tally',
                prompt: '/books',
              },
              {
                title: 'Audit Missing Docs',
                desc: 'Find pending vouchers and send client reminders',
                prompt: '/docs',
              },
              {
                title: 'Plan Workload',
                desc: 'Distribute upcoming compliance filings to staff',
                prompt: '/tasks',
              },
            ].map((card, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void executeCommand(card.prompt)}
                className="group cursor-pointer rounded-2xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--fd-border)] hover:bg-[var(--fd-surface-2)] hover:shadow-md active:translate-y-0 dark:border-[#262626] dark:bg-[#181818] dark:hover:border-[#383838] dark:hover:bg-[#212121]"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--fd-text-primary)] transition-colors group-hover:text-[var(--fd-accent)]">
                  <span>{card.title}</span>
                  <ArrowRight
                    size={12}
                    className="-translate-x-1 transform text-[var(--fd-accent)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </div>
                <div className="pt-1 text-[11px] leading-snug text-[var(--fd-text-tertiary)]">
                  {card.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── THE SEPARATE FLOATING BAR (LOCKED AT BOTTOM, INDEPENDENT OF CONVERSATION BODY) ── */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 bg-gradient-to-t from-[var(--fd-bg)] via-[var(--fd-bg)]/85 to-transparent px-4 pt-8 pb-3 dark:from-[#000000] dark:via-[#000000]/95">
        <div className="pointer-events-auto mx-auto w-full max-w-xl">
          <div className="relative">
            {/* Slash Command Autocomplete Popover */}
            {showSlashMenu && filteredSlashCommands.length > 0 && (
              <div className="absolute right-0 bottom-full left-0 z-30 mb-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-1.5 shadow-2xl dark:border-[#303030] dark:bg-[#1e1e1e]">
                <div className="flex items-center justify-between border-b border-[var(--fd-border-subtle)] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--fd-text-tertiary)] uppercase dark:border-[#262626]">
                  <span>{`Commands (${filteredSlashCommands.length})`}</span>
                  <span className="text-[var(--fd-text-secondary)]">
                    ↑↓ Navigate • ⏎ Select • Esc Close
                  </span>
                </div>
                {filteredSlashCommands.map((cmd, idx) => (
                  <button
                    key={cmd.command}
                    type="button"
                    onClick={() => handleSelectSlashCommand(cmd)}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors',
                      idx === slashSelectedIndex
                        ? 'border border-[var(--fd-border-strong)] bg-[var(--fd-surface-3)] text-[var(--fd-text-primary)] dark:border-[#444444] dark:bg-[#2f2f2f]'
                        : 'border border-transparent text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-2)] dark:hover:bg-[#262626]',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--fd-text-primary)]">
                        {cmd.command}
                      </span>
                      <span className="font-medium text-[var(--fd-text-primary)]">{cmd.label}</span>
                    </div>
                    <span className="hidden text-[11px] text-[var(--fd-text-tertiary)] sm:inline">
                      {cmd.description}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ChatGPT Bar Container (Compact, sleek default size with placeholder adjusted downside) */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFiles = e.dataTransfer?.files;
                if (droppedFiles && droppedFiles.length > 0) handleAnyFiles(droppedFiles);
              }}
              className="rounded-[26px] border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-2 shadow-2xl transition-all duration-200 focus-within:border-[var(--fd-border-strong)] focus-within:shadow-[0_0_24px_-4px_rgba(255,106,0,0.18)] sm:p-2.5 dark:border-[#303030] dark:bg-[#212121] dark:focus-within:border-[#4d4d4d] dark:focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            >
              {/* Attached Items Pre-send Preview (Supports multiple files: PDFs, Photos, Audio, Spreadsheets) */}
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex max-h-40 flex-wrap items-center gap-2 overflow-y-auto px-1 pr-1">
                  {attachedFiles.map((att, idx) => (
                    <div
                      key={`${att.name}-${idx}`}
                      className="flex scale-in items-center gap-2 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-1.5 text-xs text-[var(--fd-text-primary)] shadow-sm dark:border-[#303030] dark:bg-[#181818] dark:text-[#ececec]"
                    >
                      {att.category === 'image' ? (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="h-8 w-8 shrink-0 rounded-lg border border-[var(--fd-border-subtle)] object-cover dark:border-[#303030]"
                        />
                      ) : (
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            att.category === 'pdf'
                              ? 'border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : att.category === 'spreadsheet'
                                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : att.category === 'document'
                                  ? 'border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : att.category === 'audio'
                                    ? 'border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-[var(--fd-surface-3)] dark:bg-[#262626]',
                          )}
                        >
                          {renderFileIcon(att.category, 16)}
                        </div>
                      )}

                      <div className="flex min-w-0 flex-col pr-1">
                        <span className="max-w-[150px] truncate font-medium sm:max-w-[200px]">
                          {att.name}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[var(--fd-text-tertiary)]">
                          <span
                            className={cn(
                              'text-[10px] font-semibold tracking-wider uppercase',
                              att.category === 'pdf'
                                ? 'font-bold text-rose-600 dark:text-rose-400'
                                : '',
                            )}
                          >
                            {att.category}
                          </span>
                          <span>•</span>
                          <span>{formatFileSize(att.size)}</span>
                        </span>
                      </div>

                      {att.category === 'audio' && (
                        <AudioAttachmentPlayer src={att.dataUrl} name={att.name} className="h-7 w-32 shrink-0 rounded sm:w-40" />
                      )}

                      <button
                        type="button"
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        title={`Remove ${att.name}`}
                        className="ml-0.5 shrink-0 cursor-pointer rounded-full p-1 text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[#fb7185] dark:hover:bg-[#262626]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {attachedFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAttachedFiles([])}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[#fb7185] dark:text-[#8e8e8e] dark:hover:bg-[#212121]"
                    >
                      Clear all ({attachedFiles.length})
                    </button>
                  )}
                </div>
              )}

              {/* Universal File Input (accepts multiple files: PDFs, documents, photos, audio) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleAnyFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              {/* Main Input Row: Attach (+) on left, Placeholder / Textarea (Adjusted Downside) in center, Mic & Send on right */}
              <div className="flex items-end gap-2 px-1">
                {/* Left Group: Attach (+) */}
                <div className="mb-0.5 flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach document or image, photo, audio, file"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--fd-border-subtle)] text-[var(--fd-text-secondary)] transition-all duration-200 hover:scale-105 hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] active:scale-95 dark:border-transparent dark:text-[#b4b4b4] dark:hover:bg-[#2f2f2f] dark:hover:text-white"
                  >
                    <Plus size={16} className="transition-transform duration-200 hover:rotate-90" />
                  </button>
                </div>

                {/* Center: Textarea with placeholder sitting downside, aligned with buttons */}
                <div className="flex min-w-0 flex-1 items-center py-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={(e) => {
                      const pastedFiles = e.clipboardData?.files;
                      if (pastedFiles && pastedFiles.length > 0) {
                        e.preventDefault();
                        handleAnyFiles(pastedFiles);
                      }
                    }}
                    rows={1}
                    placeholder={
                      isRecordingVoice
                        ? `Recording audio note (${Math.floor(voiceDuration / 60)}:${(voiceDuration % 60).toString().padStart(2, '0')})... Click mic to finish`
                        : isListening
                          ? 'Listening...'
                          : 'Ask Copilot anything, or type / for commands...'
                    }
                    disabled={isExecuting}
                    className={cn(
                      'max-h-40 w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-0.5 leading-normal [overflow-wrap:anywhere] break-words text-[var(--fd-text-primary)] outline-none placeholder:text-[var(--fd-text-tertiary)] dark:text-[#ececec] dark:placeholder:text-[#8e8e8e]',
                      getUserTextSize(input),
                    )}
                  />
                </div>

                {/* Right Group: Dictation/Recording (Mic) and Circular Send / Stop */}
                <div className="mb-0.5 flex shrink-0 items-center gap-1.5">
                  {/* Voice Dictation (Mic) Button — ChatGPT minimal style */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    title={
                      isListening || isRecordingVoice
                        ? 'Stop listening'
                        : 'Dictate with voice or record audio (Mic)'
                    }
                    className={cn(
                      'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all duration-200',
                      isListening || isRecordingVoice
                        ? 'bg-black text-white shadow hover:scale-105 active:scale-95 dark:bg-white dark:text-black'
                        : 'text-[var(--fd-text-secondary)] hover:scale-105 hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] active:scale-95 dark:text-[#b4b4b4] dark:hover:bg-[#2f2f2f] dark:hover:text-white',
                    )}
                  >
                    {isListening || isRecordingVoice ? (
                      /* Sleek ChatGPT-style live wave bars inside the mic button */
                      <div className="flex h-3 items-center gap-0.5">
                        <span className="h-2 w-0.5 animate-pulse rounded-full bg-current" />
                        <span className="h-3.5 w-0.5 animate-pulse rounded-full bg-current delay-75" />
                        <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-current delay-150" />
                        <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-current delay-100" />
                      </div>
                    ) : (
                      <Mic size={16} />
                    )}
                  </button>

                  {/* ChatGPT Circular Up-Arrow Send / Stop Button */}
                  {isExecuting ? (
                    <button
                      type="button"
                      onClick={handleStopExecution}
                      title="Stop generating"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black text-white shadow transition-all duration-200 hover:scale-105 hover:opacity-90 active:scale-95 dark:bg-white dark:text-black"
                    >
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void executeCommand(input)}
                      disabled={!input.trim() && attachedFiles.length === 0}
                      title="Send message"
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
                        !input.trim() && attachedFiles.length === 0
                          ? 'cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-[#303030] dark:text-[#676767]'
                          : 'cursor-pointer bg-black text-white shadow hover:scale-105 hover:opacity-90 active:scale-95 dark:bg-white dark:text-black',
                      )}
                    >
                      <ArrowUp size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ChatGPT-style Subtext Disclaimer */}
            <p className="pt-2 text-center text-[11px] text-[var(--fd-text-tertiary)] select-none dark:text-[#737373]">
              FirmDesk Copilot can make mistakes. Verify statutory filings and book entries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
