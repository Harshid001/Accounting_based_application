import { useCallback, useState } from 'react';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  typedConfirmation?: string;
  typedHint?: string;
  onConfirm: () => void | Promise<void>;
}

export interface ConfirmController {
  request: ConfirmRequest | null;
  open: boolean;
  pending: boolean;
  ask: (request: ConfirmRequest) => void;
  cancel: () => void;
  confirm: () => void;
  setOpen: (open: boolean) => void;
}

export function useConfirm(): ConfirmController {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [pending, setPending] = useState(false);

  const ask = useCallback((next: ConfirmRequest) => {
    setRequest(next);
  }, []);

  const cancel = useCallback(() => {
    setRequest(null);
    setPending(false);
  }, []);

  const confirm = useCallback(() => {
    if (request === null) return;
    const outcome = request.onConfirm();
    if (outcome instanceof Promise) {
      setPending(true);
      void outcome.finally(() => {
        setPending(false);
        setRequest(null);
      });
      return;
    }
    setRequest(null);
  }, [request]);

  const setOpen = useCallback(
    (open: boolean) => {
      if (!open) cancel();
    },
    [cancel],
  );

  return { request, open: request !== null, pending, ask, cancel, confirm, setOpen };
}
