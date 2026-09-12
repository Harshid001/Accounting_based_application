import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/context/ToastContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConverterPage } from '@/desktop/converter/ConverterPage';

function renderConverter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/converter']}>
        <TooltipProvider>
          <LanguageProvider>
            <ToastProvider>
              <ConverterPage />
            </ToastProvider>
          </LanguageProvider>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConverterPage', () => {
  it('renders page header, popular presets, and upload dropzone', () => {
    renderConverter();

    expect(screen.getByText('File Converter & Modifier')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your file here/i)).toBeInTheDocument();
    expect(screen.getByText('PDF to Word (DOCX)')).toBeInTheDocument();
    expect(screen.getByText('PNG to JPG (White BG)')).toBeInTheDocument();
    expect(screen.getByText('CSV to PDF / JSON')).toBeInTheDocument();
  });

  it('scans imported file and reveals user override format selector', async () => {
    const user = userEvent.setup();
    renderConverter();

    const fileInput = screen.getByTestId('file-input');
    const testFile = new File(['Invoice #12345\nTax: Rs 500'], 'invoice.txt', {
      type: 'text/plain',
    });

    await user.upload(fileInput, testFile);

    await waitFor(() => {
      expect(screen.getByText('invoice.txt')).toBeInTheDocument();
    });

    // Verify user override label and selector are rendered
    expect(
      screen.getByText(/Imported File Type \(User Confirmation & Override\):/i),
    ).toBeInTheDocument();

    // Verify target options are shown
    expect(screen.getByText(/Choose Target Format & Adjust Settings/i)).toBeInTheDocument();
    expect(screen.getByTestId('target-format-docx')).toBeInTheDocument();
  });

  it('updates available target options when user overrides imported format to PDF', async () => {
    const user = userEvent.setup();
    renderConverter();

    const fileInput = screen.getByTestId('file-input');
    const testFile = new File(['Mock document'], 'document.bin', {
      type: 'application/octet-stream',
    });

    await user.upload(fileInput, testFile);

    await waitFor(() => {
      expect(screen.getByText('document.bin')).toBeInTheDocument();
    });

    const overrideSelect = screen.getByLabelText(
      /Imported File Type \(User Confirmation & Override\):/i,
    );
    expect(overrideSelect).toBeInTheDocument();

    // User changes imported file type to PDF
    fireEvent.change(overrideSelect, { target: { value: 'pdf' } });

    await waitFor(() => {
      // PDF targets should now be displayed
      expect(screen.getByTestId('target-format-docx')).toBeInTheDocument();
      expect(screen.getByTestId('target-format-png')).toBeInTheDocument();
      expect(screen.getByTestId('target-format-jpg')).toBeInTheDocument();
    });
  });
});
