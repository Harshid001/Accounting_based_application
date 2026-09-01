import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MAX_UPLOAD_BYTES } from '@/lib/constants';
import { checkFile, useDocumentUpload } from '@/hooks/useDocumentUpload';
import { stubFetch } from '../helpers/server';

const makeFile = (name: string, type: string, size: number): File => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('checkFile', () => {
  it('accepts every allowed extension', () => {
    const allowed: Array<[string, string]> = [
      ['return.pdf', 'application/pdf'],
      ['scan.jpg', 'image/jpeg'],
      ['scan.jpeg', 'image/jpeg'],
      ['stamp.png', 'image/png'],
      ['ledger.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['ledger.xls', 'application/vnd.ms-excel'],
      ['data.csv', 'text/csv'],
      ['letter.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['bundle.zip', 'application/zip'],
    ];

    for (const [name, mimeType] of allowed) {
      const result = checkFile(makeFile(name, mimeType, 1024));
      expect(result.ok).toBe(true);
      expect(result.mimeType).toBe(mimeType);
      expect(result.message).toBeNull();
    }
  });

  it('refuses an executable and names the types it does accept', () => {
    const result = checkFile(makeFile('payload.exe', 'application/octet-stream', 2048));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PDF');
    expect(result.message).toContain('.exe');
  });

  it('refuses a file with no extension at all', () => {
    const result = checkFile(makeFile('README', 'text/plain', 512));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no extension');
  });

  it('refuses anything past the 25 MB ceiling', () => {
    const result = checkFile(makeFile('huge.pdf', 'application/pdf', 30 * 1024 * 1024));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('25 MB');
  });

  it('accepts a file exactly on the ceiling', () => {
    expect(checkFile(makeFile('edge.pdf', 'application/pdf', MAX_UPLOAD_BYTES)).ok).toBe(true);
  });

  it('refuses an empty file', () => {
    const result = checkFile(makeFile('empty.pdf', 'application/pdf', 0));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('empty');
  });

  it('derives the MIME type from the extension, not the browser-reported type', () => {
    expect(checkFile(makeFile('return.pdf', '', 1024)).mimeType).toBe('application/pdf');
  });
});

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children,
  );

describe('useDocumentUpload guards', () => {
  it('refuses a disallowed type before any network call is made', async () => {
    const stub = stubFetch([{ match: '/documents/presign-upload', data: {} }]);
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.uploadNew({
        clientId: 'client-1',
        file: makeFile('payload.exe', 'application/octet-stream', 2048),
        title: 'Payload',
        documentType: 'other',
        customTypeLabel: 'Payload',
      });
    });

    expect(created).toBeNull();
    expect(stub.calls).toHaveLength(0);
    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
    expect(result.current.error).toContain('PDF');
  });

  it('refuses an oversized file before any network call is made', async () => {
    const stub = stubFetch([{ match: '/documents/presign-upload', data: {} }]);
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.uploadNew({
        clientId: 'client-1',
        file: makeFile('huge.pdf', 'application/pdf', 30 * 1024 * 1024),
        title: 'Huge',
        documentType: 'other',
        customTypeLabel: 'Huge',
      });
    });

    expect(created).toBeNull();
    expect(stub.calls).toHaveLength(0);
    expect(result.current.error).toContain('25 MB');
  });

  it('makes the same guard on a new version', async () => {
    const stub = stubFetch([{ match: '/documents/presign-upload', data: {} }]);
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadVersion({
        clientId: 'client-1',
        documentId: 'doc-1',
        file: makeFile('script.sh', 'text/x-shellscript', 128),
      });
    });

    expect(stub.calls).toHaveLength(0);
    expect(result.current.phase).toBe('error');
  });

  it('runs the three-call handshake in order for an allowed file', async () => {
    const stub = stubFetch([
      {
        match: '/documents/presign-upload',
        data: {
          uploadUrl: 'https://storage.test/put/abc',
          storageKey: 'clients/1/abc',
          expiresIn: 60,
        },
      },
      { match: 'storage.test', data: null },
      { match: '/documents', data: { id: 'doc-9', title: 'Bank statement' } },
    ]);

    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadNew({
        clientId: 'client-1',
        file: makeFile('statement.pdf', 'application/pdf', 4096),
        title: 'Bank statement',
        documentType: 'bank_statement',
      });
    });

    expect(stub.calls[0]).toContain('/documents/presign-upload');
    expect(stub.calls[1]).toBe('https://storage.test/put/abc');
    expect(stub.calls[2]).toContain('/documents');
    await waitFor(() => {
      expect(result.current.phase).toBe('done');
    });
  });

  it('sends no credentials and only a content type on the storage PUT', async () => {
    const seen: RequestInit[] = [];
    stubFetch([
      {
        match: '/documents/presign-upload',
        data: {
          uploadUrl: 'https://storage.test/put/abc',
          storageKey: 'clients/1/abc',
          expiresIn: 60,
        },
      },
      { match: 'storage.test', data: null },
      { match: '/documents', data: { id: 'doc-9', title: 'Bank statement' } },
    ]);

    const stubbed = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('storage.test') && init !== undefined) seen.push(init);
      return stubbed(input, init);
    });

    const { result } = renderHook(() => useDocumentUpload(), { wrapper });
    await act(async () => {
      await result.current.uploadNew({
        clientId: 'client-1',
        file: makeFile('statement.pdf', 'application/pdf', 4096),
        title: 'Bank statement',
        documentType: 'bank_statement',
      });
    });

    expect(seen).toHaveLength(1);
    const put = seen[0];
    expect(put?.method).toBe('PUT');
    expect(put?.credentials).toBeUndefined();
    expect(put?.headers).toEqual({ 'Content-Type': 'application/pdf' });
  });
});
