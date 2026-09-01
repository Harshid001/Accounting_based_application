import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  if (!('matchMedia' in window)) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  if (!('ResizeObserver' in window)) {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    });
  }

  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.scrollIntoView ??= (): void => undefined;

  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { writable: true, value: MouseEvent });
  }
  proto.hasPointerCapture ??= (): boolean => false;
  proto.setPointerCapture ??= (): void => undefined;
  proto.releasePointerCapture ??= (): void => undefined;

  Object.defineProperty(window, 'scrollTo', { writable: true, value: () => undefined });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
