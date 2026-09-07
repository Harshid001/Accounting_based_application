import { beforeAll, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { convertFile, DEFAULT_IMAGE_OPTIONS, DEFAULT_PDF_OPTIONS } from '@/lib/converter/conversionEngine';
import type * as pdfjsModule from '@/lib/converter/pdfjs';
import type { ConversionJob, FileScanResult, PdfModificationOptions, SupportedFormat } from '@/lib/converter/types';

vi.mock('@/lib/converter/pdfjs', async (importOriginal) => {
  const actual = await importOriginal<typeof pdfjsModule>();
  const fakeCanvas = {
    width: 100,
    height: 100,
    toDataURL: () => 'data:image/png;base64,AAAA',
    toBlob: (cb: (b: Blob | null) => void, _type?: string) => cb(new Blob(['img'], { type: 'image/png' })),
  } as unknown as HTMLCanvasElement;
  return {
    ...actual,
    renderPdfPageToCanvas: vi.fn(() => Promise.resolve(fakeCanvas)),
  };
});

async function buildThreePagePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Page ${i}`, { x: 60, y: 780, size: 14, font });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function pdfOpts(pageRange: PdfModificationOptions['pageRange'], customPages?: string): PdfModificationOptions {
  return { pageRange, customPages, rotate: 0, compressMetadata: true };
}

function makeJob(
  file: File,
  detectedFormat: SupportedFormat,
  targetFormat: SupportedFormat,
  pdfOptions?: ConversionJob['pdfOptions'],
): ConversionJob {
  const scan: FileScanResult = {
    fileName: file.name,
    originalExtension: file.name.split('.').pop() || '',
    fileSizeBytes: file.size,
    fileSizeFormatted: `${file.size} B`,
    mimeType: file.type,
    detectedFormat,
    confidence: 'high',
    magicMatch: false,
  };
  return {
    sourceFile: file,
    scanResult: scan,
    userOverrideFormat: detectedFormat,
    targetFormat,
    imageOptions: DEFAULT_IMAGE_OPTIONS,
    pdfOptions: pdfOptions ?? DEFAULT_PDF_OPTIONS,
  };
}

describe('PDF → image export', () => {
  let pdfFile: File;

  beforeAll(async () => {
    pdfFile = new File([await buildThreePagePdf()], 'report.pdf', { type: 'application/pdf' });
  });

  it('zips multiple pages with pageRange custom', async () => {
    const options = pdfOpts('custom', '2-3');
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'png', options));

    expect(result.mimeType).toBe('application/zip');
    const zip = await JSZip.loadAsync(result.blob);
    const names = Object.keys(zip.files);

    expect(names).toContain('report_page_2.png');
    expect(names).toContain('report_page_3.png');
    expect(names).not.toContain('report_page_1.png');
  });

  it('exports only the first page when pageRange is first (single image blob)', async () => {
    const options = pdfOpts('first');
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'png', options));

    expect(result.mimeType).toBe('image/png');
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('falls back to all pages on an invalid custom range', async () => {
    const options = pdfOpts('custom', 'bogus');
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'png', options));

    expect(result.mimeType).toBe('application/zip');
    const zip = await JSZip.loadAsync(result.blob);
    const names = Object.keys(zip.files);

    expect(names).toHaveLength(3);
  });

  it('exports single page as JPG (stubbed object URL for preview)', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revokeObjectURL });

    const options = pdfOpts('first');
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'jpg', options));

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.previewUrl).toBe('blob:mock');
    expect(createObjectURL).toHaveBeenCalled();
  });
});