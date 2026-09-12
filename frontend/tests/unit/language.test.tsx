import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';

import {
  LanguageProvider,
  LANGUAGE_STORAGE_KEY,
} from '@/context/LanguageContext';
import { LanguagePreferencePanel } from '@/shared/LanguagePreferencePanel/LanguagePreferencePanel';
import { ToastProvider } from '@/context/ToastContext';
import { SessionContext } from '@/context/SessionContext';
import type { Me } from '@/types/models';

const mockUser: Me = {
  id: 'usr_test',
  email: 'partner@jvtaxconsultancy.com',
  name: 'Harshid Partner',
  role: 'staff',
  phone: '9820012345',
  status: 'active',
  image: null,
  emailVerified: true,
  linkedClients: [],
  pinnedClients: [],
  unlinked: false,
  permissions: {},
  notificationPreferences: {
    emailOnAssignment: true,
    emailDeadlineReminders: true,
    emailDailyDigest: false,
  },
};

function renderPanel() {
  return render(
    <SessionContext.Provider
      value={{
        status: 'authenticated',
        user: mockUser,
        refresh: () => Promise.resolve(undefined),
        clear: () => undefined,
        pendingVerification: null,
        error: null,
        allows: (_capability) => true,
      }}
    >
      <ToastProvider>
        <LanguageProvider>
          <LanguagePreferencePanel />
        </LanguageProvider>
      </ToastProvider>
    </SessionContext.Provider>
  );
}

describe('Language Preference & Regional Options', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('renders all four requested languages: Hindi, Gujarati, English, Marathi', () => {
    renderPanel();

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('ગુજરાતી')).toBeInTheDocument();
    expect(screen.getByText('मराठी')).toBeInTheDocument();

    expect(screen.getByText('(Hindi)')).toBeInTheDocument();
    expect(screen.getByText('(Gujarati)')).toBeInTheDocument();
    expect(screen.getByText('(Marathi)')).toBeInTheDocument();
  });

  it('switches to Hindi when clicked, updates html lang and persists to localStorage', async () => {
    const user = userEvent.setup();
    renderPanel();

    const hindiBtn = screen.getByRole('radio', { name: /हिन्दी/i });
    await user.click(hindiBtn);

    expect(hindiBtn).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.lang).toBe('hi');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('hi');
  });

  it('switches to Gujarati when clicked', async () => {
    const user = userEvent.setup();
    renderPanel();

    const gujaratiBtn = screen.getByRole('radio', { name: /ગુજરાતી/i });
    await user.click(gujaratiBtn);

    expect(gujaratiBtn).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.lang).toBe('gu');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('gu');
  });

  it('switches to Marathi when clicked', async () => {
    const user = userEvent.setup();
    renderPanel();

    const marathiBtn = screen.getByRole('radio', { name: /मराठी/i });
    await user.click(marathiBtn);

    expect(marathiBtn).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.lang).toBe('mr');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('mr');
  });
});
