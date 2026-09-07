import { describe, expect, it } from 'vitest';
import {
  detectMagicSignature,
  extractFileExtension,
  scanFile,
  SUPPORTED_FORMAT_METAS,
} from '@/lib/converter/fileScanner';

describe('fileScanner', () => {
  it('correctly extracts file extensions', () => {
    expect(extractFileExtension('invoice.pdf')).toBe('pdf');
    expect(extractFileExtension('pan_card.PNG')).toBe('png');
    expect(extractFileExtension('bank_statement.xlsx')).toBe('xlsx');
    expect(extractFileExtension('archive.tar.gz')).toBe('gz');
    expect(extractFileExtension('noextension')).toBe('');
  });

  it('provides metadata for all supported formats', () => {
    expect(SUPPORTED_FORMAT_METAS.pdf.label).toBe('PDF Document');
    expect(SUPPORTED_FORMAT_METAS.docx.label).toContain('Word');
    expect(SUPPORTED_FORMAT_METAS.png.mimeType).toBe('image/png');
    expect(SUPPORTED_FORMAT_METAS.jpg.mimeType).toBe('image/jpeg');
    expect(SUPPORTED_FORMAT_METAS.csv.category).toBe('spreadsheet');
  });

  it('detects PDF magic bytes (%PDF-)', async () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    const file = new File([pdfHeader], 'test.pdf', { type: 'application/pdf' });
    const result = await detectMagicSignature(file);

    expect(result.magicMatch).toBe(true);
    expect(result.detected).toBe('pdf');
  });

  it('detects PNG magic bytes', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const file = new File([pngHeader], 'photo.png', { type: 'image/png' });
    const result = await detectMagicSignature(file);

    expect(result.magicMatch).toBe(true);
    expect(result.detected).toBe('png');
  });

  it('detects JPEG / JPG magic bytes', async () => {
    const jpgHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const file = new File([jpgHeader], 'photo.jpg', { type: 'image/jpeg' });
    const result = await detectMagicSignature(file);

    expect(result.magicMatch).toBe(true);
    expect(result.detected).toBe('jpg');
  });

  it('detects ZIP / DOCX magic bytes', async () => {
    const docxHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const file = new File([docxHeader], 'agreement.docx');
    const result = await detectMagicSignature(file);

    expect(result.magicMatch).toBe(true);
    expect(result.detected).toBe('docx');
  });

  it('disambiguates an XLSX named with a .docx extension by workbook paths', async () => {
    const ascii = (str: string) => Uint8Array.from(str, (ch) => ch.charCodeAt(0));
    const header = new Uint8Array([
      ...[0x50, 0x4b, 0x03, 0x04],
      ...ascii('xl/workbook.xml'),
    ]);
    const file = new File([header], 'misnamed.docx');
    const result = await detectMagicSignature(file);

    expect(result.magicMatch).toBe(true);
    expect(result.detected).toBe('xlsx');
  });

  it('disambiguates a DOCX named with an .xlsx extension by document paths', async () => {
    const ascii = (str: string) => Uint8Array.from(str, (ch) => ch.charCodeAt(0));
    const header = new Uint8Array([
      ...[0x50, 0x4b, 0x03, 0x04],
      ...ascii('word/document.xml'),
    ]);
    const file = new File([header], 'misnamed.xlsx');
    const result = await detectMagicSignature(file);

    expect(result.magicMatch).toBe(true);
    expect(result.detected).toBe('docx');
  });

  it('scans a plain text file correctly', async () => {
    const content = 'Header 1\nLine 2 of statement\nLine 3 of statement';
    const file = new File([content], 'notes.txt', { type: 'text/plain' });
    const result = await scanFile(file);

    expect(result.detectedFormat).toBe('txt');
    expect(result.fileName).toBe('notes.txt');
    expect(result.lineCountEstimate).toBe(3);
    expect(result.wordCountEstimate).toBe(10);
  });

  it('reads PNG dimensions from the byte header when the decoder is unavailable', async () => {
    // 1x1 PNG: magic + IHDR with width=1, height=1 (big-endian).
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, // width = 1
      0x00, 0x00, 0x00, 0x01, // height = 1
    ]);
    const file = new File([pngBytes], 'pixel.png', { type: 'image/png' });
    const result = await scanFile(file);

    expect(result.detectedFormat).toBe('png');
    expect(result.dimensions).toEqual({ width: 1, height: 1 });
  });

  it('reads JPEG dimensions from SOF markers when the decoder is unavailable', async () => {
    // Minimal JPEG skeleton: SOI, APP0 (JFIF), then SOF0 with 2x3 dimensions.
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, // APP0 segment (length 4)
      0xff, 0xc0, 0x00, 0x08, // SOF0, segment length 8
      0x08, // sample precision
      0x00, 0x02, // height = 2
      0x00, 0x03, // width = 3
      0x01, // components
    ]);
    const file = new File([jpegBytes], 'tiny.jpg', { type: 'image/jpeg' });
    const result = await scanFile(file);

    expect(result.detectedFormat).toBe('jpg');
    expect(result.dimensions).toEqual({ width: 3, height: 2 });
  });
});
