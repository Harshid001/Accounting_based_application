/**
 * SSE for both shells (spec §5.3). In the web shell `EventSource` sends
 * cookies via `withCredentials`. In the desktop shell the Tauri webview's
 * `EventSource` cannot carry the cross-origin session cookie reliably, so
 * the stream falls back to a credentialed `fetch` readable stream that parses
 * the same `text/event-stream` wire format. One module, one wire, both shells.
 */
import { env } from '@/lib/env';
import { isDesktop } from '@/lib/shell';

export interface SseHandlers {
  onMessage: (data: string) => void;
  onError?: () => void;
}

export interface SseSubscription {
  close: () => void;
}

const sseUrl = (path: string): string => {
  const base = env.apiBaseUrl.replace(/\/+$/, '');
  return `${base}${path}`;
}

/**
 * Parses incremental `data:` frames out of a text/event-stream chunk.
 * Exported for deterministic unit tests: partial frames, CRLF servers,
 * multi-event chunks, and events split across reads.
 */
export const parseEventStreamChunk = (
  buffer: string,
): { events: string[]; rest: string } => {
  const events: string[] = [];
  let rest = buffer;
  for (;;) {
    const separator = rest.search(/\r?\n\r?\n/);
    if (separator === -1) break;
    const rawEvent = rest.slice(0, separator);
    rest = rest.slice(separator).replace(/^\r?\n\r?\n/, '');
    const dataLines = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));
    if (dataLines.length > 0) events.push(dataLines.join('\n'));
  }
  return { events, rest };
};

const subscribeViaFetch = async (
  url: string,
  handlers: SseHandlers,
  closed: () => boolean,
): Promise<() => void> => {
  const controller = new AbortController();
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  if (!response.ok || response.body === null) throw new Error(`SSE stream failed (${response.status})`);

  // Node/undici streams carry getReader; the DOM lib types it as a plain
  // ReadableStream, so narrow through the reader the stream actually has.
  const stream = response.body as ReadableStream<Uint8Array> & {
    getReader(): ReadableStreamDefaultReader<Uint8Array>;
    cancel?: (reason?: unknown) => Promise<void>;
  };
  const reader = stream.getReader();
  void (async () => {
    const decoder = new TextDecoder();
    let pending = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || closed()) break;
        pending += decoder.decode(value, { stream: true });
        const { events, rest } = parseEventStreamChunk(pending);
        pending = rest;
        for (const event of events) handlers.onMessage(event);
      }
    } catch {
      if (!closed()) handlers.onError?.();
    }
  })();

  return () => {
    controller.abort();
    void reader.cancel().catch(() => undefined);
  };
};

const subscribeViaEventSource = (url: string, handlers: SseHandlers): (() => void) => {
  const source = new EventSource(url, { withCredentials: true });
  source.onmessage = (event: MessageEvent) => handlers.onMessage(String(event.data));
  source.onerror = () => handlers.onError?.();
  return () => {
    source.close();
  };
};

/**
 * Subscribe to an SSE endpoint. `path` is relative to the API base
 * (e.g. `/automation/runs/{id}/events`). Returns a handle with `close()`.
 */
export const subscribeSse = (path: string, handlers: SseHandlers): SseSubscription => {
  const url = sseUrl(path);
  let closed = false;
  let stop: (() => void) | null = null;

  if (isDesktop) {
    // Desktop webview: credentialed fetch stream (cookies attach).
    void subscribeViaFetch(url, handlers, () => closed)
      .then((closeFn) => {
        if (closed) {
          closeFn();
          return;
        }
        stop = closeFn;
      })
      .catch(() => handlers.onError?.());
  } else {
    stop = subscribeViaEventSource(url, handlers);
  }

  return {
    close: () => {
      closed = true;
      stop?.();
    },
  };
};
