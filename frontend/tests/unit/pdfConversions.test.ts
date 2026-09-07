import { beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  convertFile,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  extractTextFromDocx,
  extractTextFromPdf,
} from '@/lib/converter/conversionEngine';
import type { ConversionJob, FileScanResult, SupportedFormat } from '@/lib/converter/types';

async function buildSamplePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page1 = doc.addPage([595.28, 841.89]);
  page1.drawText('Annual Financial Report', { x: 60, y: 780, size: 20, font: boldFont });
  page1.drawText('Prepared for the FY 2026 audit.', { x: 60, y: 750, size: 12, font });

  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawText('Balance Sheet Summary', { x: 60, y: 780, size: 18, font: boldFont });
  page2.drawText('Total assets reconciled.', { x: 60, y: 750, size: 12, font });

  const page3 = doc.addPage([595.28, 841.89]);
  page3.drawText('Cash Flow Statement', { x: 60, y: 780, size: 18, font: boldFont });
  page3.drawText('Net increase observed.', { x: 60, y: 750, size: 12, font });

  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function makeJob(file: File, detectedFormat: SupportedFormat, targetFormat: SupportedFormat): ConversionJob {
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
    pdfOptions: DEFAULT_PDF_OPTIONS,
  };
}

describe('PDF text extraction (pdf-lib → pdf.js round trip)', () => {
  let pdfBytes: ArrayBuffer;
  let pdfFile: File;

  beforeAll(async () => {
    pdfBytes = await buildSamplePdf();
    pdfFile = new File([pdfBytes], 'report.pdf', { type: 'application/pdf' });
  });

  it('extracts real text via the legacy pdf.js build', async () => {
    const lines = await extractTextFromPdf(pdfBytes);
    const joined = lines.join('\n');

    expect(joined).toContain('Annual Financial Report');
    expect(joined).toContain('Balance Sheet Summary');
    expect(joined).toContain('Cash Flow Statement');
    expect(joined).toContain('Prepared for the FY 2026 audit.');
  });

  it('converts PDF to TXT through convertFile', async () => {
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'txt'));
    const text = await result.blob.text();

    expect(result.outputFileName).toBe('report-converted.txt');
    expect(text).toContain('Annual Financial Report');
    expect(text).toContain('Total assets reconciled.');
  });

  it('converts PDF to DOCX and the DOCX round-trips its headings/text', async () => {
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'docx'));
    const docxFile = new File([result.blob], 'report.docx', { type: result.mimeType });
    const lines = await extractTextFromDocx(docxFile);
    const joined = lines.join('\n');

    expect(result.mimeType).toContain('wordprocessingml');
    expect(joined).toContain('Annual Financial Report');
    expect(joined).toContain('Balance Sheet Summary');
  });

  it('converts PDF to HTML preserving extracted text', async () => {
    const result = await convertFile(makeJob(pdfFile, 'pdf', 'html'));
    const html = await result.blob.text();

    expect(html).toContain('Annual Financial Report');
    expect(html).toContain('<body');
  });

  it('generates no empty metadata when pages lack text', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
    const saved = await doc.save();
    const emptyBytes = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
    const lines = await extractTextFromPdf(emptyBytes);

    expect(lines.join('\n')).toContain('page(s)');
  });
});