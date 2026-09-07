import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FilterBar } from '@/components/domain/FilterBar';
import { CommandPalette } from '@/components/domain/CommandPalette';
import { FeatureGuideModal } from '@/components/domain/FeatureGuideModal';
import { FeatureGuideProvider, useFeatureGuide } from '@/context/FeatureGuideContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithContext(ui: React.ReactNode, initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <FeatureGuideProvider>
              {ui}
            </FeatureGuideProvider>
          </LanguageProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Usability Enhancements Across Features', () => {
  it('renders FilterBar with 1-click presets and handles click events', async () => {
    const user = userEvent.setup();
    const handlePresetClick = vi.fn();

    render(
      <FilterBar
        search=""
        onSearchChange={() => undefined}
        filters={[]}
        values={{}}
        onFilterChange={() => undefined}
        activeFilters={[]}
        onClear={() => undefined}
        presets={[
          {
            id: 'due7',
            label: 'Due in 7 Days',
            active: false,
            onClick: handlePresetClick,
          },
          {
            id: 'overdue',
            label: 'Overdue Filings',
            active: true,
            onClick: () => undefined,
          },
        ]}
      />,
    );

    const due7Btn = screen.getByRole('button', { name: /Due in 7 Days/i });
    const overdueBtn = screen.getByRole('button', { name: /Overdue Filings/i });

    expect(due7Btn).toBeInTheDocument();
    expect(overdueBtn).toBeInTheDocument();

    await user.click(due7Btn);
    expect(handlePresetClick).toHaveBeenCalledTimes(1);
  });

  it('renders CommandPalette with quick launch navigation items when query is empty', () => {
    renderWithContext(
      <CommandPalette open={true} onOpenChange={() => undefined} />,
    );

    // Should render quick actions and quick navigation items
    expect(screen.getByText(/Feature Guide & Interactive Tour/i)).toBeInTheDocument();
    expect(screen.getByText(/Add New Client/i)).toBeInTheDocument();
    expect(screen.getByText(/Executive Dashboard/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Statutory Filings/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Document Vault/i)).toBeInTheDocument();
  });

  it('renders CommandPalette with attached image and AI analysis action when image is provided', () => {
    const dummyImage = {
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      name: 'invoice-sample.png',
      mimeType: 'image/png',
    };

    renderWithContext(
      <CommandPalette open={true} onOpenChange={() => undefined} initialImage={dummyImage} />,
    );

    expect(screen.getByText(/invoice-sample.png/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyze Document with FirmDesk AI Copilot/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze with AI/i })).toBeInTheDocument();
  });

  it('renders feature guide content properly in FeatureGuideModal', async () => {
    const user = userEvent.setup();

    function TestApp() {
      const { openGuide } = useFeatureGuide();
      return (
        <div>
          <button type="button" onClick={() => openGuide('dashboard')}>
            Open Guide
          </button>
          <FeatureGuideModal />
        </div>
      );
    }

    renderWithContext(<TestApp />, '/dashboard');

    // Click trigger to open modal
    await user.click(screen.getByRole('button', { name: 'Open Guide' }));

    // Verify modal is open with Dashboard guide
    expect(screen.getByRole('heading', { name: /Executive Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/In Simple Terms/i)).toBeInTheDocument();
    expect(screen.getByText(/Why This Matters/i)).toBeInTheDocument();
  });
});
