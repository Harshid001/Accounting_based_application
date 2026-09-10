import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSignInHint, readSignInHint, writeSignInHint } from '@/lib/signInHint';
import * as shell from '@/lib/shell';

/**
 * The desktop sign-in hint (spec §5.3 boot restore): a localStorage copy
 * of the keychain snapshot's email so the sign-in form can pre-fill it.
 * Guards only — the hint must be a no-op outside the desktop shell and
 * must survive locked-down storage (the hint is optional, never fatal).
 */

const setItem = vi.fn();
const getItem = vi.fn();
const removeItem = vi.fn();

vi.stubGlobal('window', {
  localStorage: { setItem, getItem, removeItem },
});

describe('sign-in hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips the hint in the desktop shell', () => {
    if (shell.SHELL !== 'desktop') return; // guard behaviour is shell-gated
    getItem.mockReturnValueOnce('priya@firm.example');
    expect(readSignInHint()).toBe('priya@firm.example');
    expect(getItem).toHaveBeenCalledWith('firmdesk.sign-in-hint');

    writeSignInHint('rahul@firm.example');
    expect(setItem).toHaveBeenCalledWith('firmdesk.sign-in-hint', 'rahul@firm.example');

    clearSignInHint();
    expect(removeItem).toHaveBeenCalledWith('firmdesk.sign-in-hint');
  });

  it('is a no-op in the web shell', () => {
    if (shell.SHELL === 'desktop') return;
    writeSignInHint('someone@firm.example');
    readSignInHint();
    clearSignInHint();
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns null when nothing is stored', () => {
    if (shell.SHELL !== 'desktop') return;
    getItem.mockReturnValueOnce(null);
    expect(readSignInHint()).toBeNull();
  });

  it('never throws when storage throws', () => {
    if (shell.SHELL !== 'desktop') return;
    getItem.mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceeded');
    });
    removeItem.mockImplementationOnce(() => {
      throw new Error('locked');
    });
    expect(readSignInHint()).toBeNull();
    expect(() => writeSignInHint('x@y.test')).not.toThrow();
    expect(() => clearSignInHint()).not.toThrow();
  });
});
