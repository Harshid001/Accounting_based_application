import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  key: string;
  meta?: boolean;
  shift?: boolean;
  allowInInput?: boolean;
  enabled?: boolean;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export function useHotkey(options: HotkeyOptions, handler: () => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const { key, meta = false, shift = false, allowInInput = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (meta && !(event.metaKey || event.ctrlKey)) return;
      if (!meta && (event.metaKey || event.ctrlKey || event.altKey)) return;
      if (shift !== event.shiftKey) return;
      if (!allowInInput && isTypingTarget(event.target)) return;
      event.preventDefault();
      handlerRef.current();
    };

    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [key, meta, shift, allowInInput, enabled]);
}
