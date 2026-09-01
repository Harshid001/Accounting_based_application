import { useEffect, useRef } from 'react';

export interface ReturnFocus {
  onCloseAutoFocus: (event: Event) => void;
}

export function useReturnFocus(open: boolean): ReturnFocus {
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) return;
    const record = (event: FocusEvent): void => {
      if (event.target instanceof HTMLElement) lastFocused.current = event.target;
    };
    document.addEventListener('focusin', record);
    return () => {
      document.removeEventListener('focusin', record);
    };
  }, [open]);

  return {
    onCloseAutoFocus: (event: Event) => {
      const target = lastFocused.current;
      if (target === null || !document.contains(target)) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}
