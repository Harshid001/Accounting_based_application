import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useHotkey } from '@/hooks/useHotkey';

const AI_CHAT_WIDTH_KEY = 'fd_ai_chat_width';
const AI_CHAT_OPEN_KEY = 'fd_ai_chat_open';

const DEFAULT_WIDTH = 440;
const EXPANDED_WIDTH = 640;
const MIN_WIDTH = 340;
const MAX_WIDTH = 800;

export interface AiChatContextValue {
  isAiChatOpen: boolean;
  openAiChat: () => void;
  closeAiChat: () => void;
  toggleAiChat: () => void;
  chatWidth: number;
  setChatWidth: (width: number) => void;
  isExpanded: boolean;
  toggleExpanded: () => void;
  pendingPrompt: string | null;
  openWithPrompt: (prompt: string) => void;
  clearPendingPrompt: () => void;
}

const readStoredWidth = (): number => {
  try {
    const val = window.localStorage.getItem(AI_CHAT_WIDTH_KEY);
    if (!val) return DEFAULT_WIDTH;
    const num = parseInt(val, 10);
    return Number.isFinite(num) && num >= MIN_WIDTH && num <= MAX_WIDTH ? num : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

export const defaultContext: AiChatContextValue = {
  isAiChatOpen: false,
  openAiChat: () => undefined,
  closeAiChat: () => undefined,
  toggleAiChat: () => undefined,
  chatWidth: DEFAULT_WIDTH,
  setChatWidth: () => undefined,
  isExpanded: false,
  toggleExpanded: () => undefined,
  pendingPrompt: null,
  openWithPrompt: () => undefined,
  clearPendingPrompt: () => undefined,
};

export const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidthState] = useState<number>(readStoredWidth);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const openAiChat = useCallback(() => {
    setIsOpen(true);
    try {
      window.localStorage.setItem(AI_CHAT_OPEN_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  const closeAiChat = useCallback(() => {
    setIsOpen(false);
    try {
      window.localStorage.setItem(AI_CHAT_OPEN_KEY, 'false');
    } catch {
      // ignore
    }
  }, []);

  const toggleAiChat = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AI_CHAT_OPEN_KEY, next ? 'true' : 'false');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setChatWidth = useCallback((newWidth: number) => {
    const clamped = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH);
    setWidthState(clamped);
    setIsExpanded(clamped >= EXPANDED_WIDTH - 20);
    try {
      window.localStorage.setItem(AI_CHAT_WIDTH_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      const targetWidth = next ? EXPANDED_WIDTH : DEFAULT_WIDTH;
      setWidthState(targetWidth);
      try {
        window.localStorage.setItem(AI_CHAT_WIDTH_KEY, String(targetWidth));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openWithPrompt = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setIsOpen(true);
  }, []);

  const clearPendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  // Hotkey: Ctrl + J or Cmd + J to toggle AI sidebar
  useHotkey({ key: 'j', meta: true, allowInInput: false }, toggleAiChat);

  // Also support Escape to close if open and not in active input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // Only close if user hits escape outside modal popups
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          closeAiChat();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeAiChat]);

  const value = useMemo(
    () => ({
      isAiChatOpen: isOpen,
      openAiChat,
      closeAiChat,
      toggleAiChat,
      chatWidth: width,
      setChatWidth,
      isExpanded,
      toggleExpanded,
      pendingPrompt,
      openWithPrompt,
      clearPendingPrompt,
    }),
    [
      isOpen,
      openAiChat,
      closeAiChat,
      toggleAiChat,
      width,
      setChatWidth,
      isExpanded,
      toggleExpanded,
      pendingPrompt,
      openWithPrompt,
      clearPendingPrompt,
    ],
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat(): AiChatContextValue {
  const context = useContext(AiChatContext);
  return context ?? defaultContext;
}
