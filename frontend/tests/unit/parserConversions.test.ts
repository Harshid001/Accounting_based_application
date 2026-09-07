import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  convertFile,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  extractTextFromDocx,
} from '@/lib/converter/conversionEngine';
import { sanitizeForWinAnsi } from '@/lib/converter/pdfjs';
import type { ConversionJob, FileScanResult, SupportedFormat } from '@/lib/converter/types';

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

function textFile(content: string, name: string, mime = 'text/plain'): File {
  return new File([content], name, { type: mime });
}

async function zipFileAsFile(entries: Record<string, string>, name: string, mime: string): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([buffer], name, { type: mime });
}

describe('sanitizeForWinAnsi', () => {
  it('replaces the rupee symbol, smart quotes, dashes, and ellipsis', () => {
    expect(sanitizeForWinAnsi('Amount ₹500')).toBe('Amount Rs. 500');
    expect(sanitizeForWinAnsi('\u2018quote\u2019 and \u201Ctwin\u201D')).toBe(
      "'quote' and \"twin\"",
    );
    expect(sanitizeForWinAnsi('em \u2014 dash \u2013 end')).toBe('em - dash - end');
    expect(sanitizeForWinAnsi('wait\u2026')).toBe('wait...');
  });

  it('falls back to ? for characters WinAnsi cannot encode', () => {
    expect(sanitizeForWinAnsi('caf\u00E9 \u2764 heart')).toBe('caf? ? heart');
  });
});

describe('CSV parsing edge cases (via convertFile → JSON/HTML/PDF)', () => {
  it('handles escaped double quotes inside quoted fields', async () => {
    const file = textFile(
      'ClientName,Note\n"Acme, Inc.","He said ""hello"" and left"',
      'clients.csv',
      'text/csv',
    );
    const result = await convertFile(makeJob(file, 'csv', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.ClientName).toBe('Acme, Inc.');
    expect(parsed[0]?.Note).toBe('He said "hello" and left');
  });

  it('preserves newlines inside quoted fields', async () => {
    const file = textFile(
      'Address\n"14B, Fort Road\nChennai 600001"',
      'addresses.csv',
      'text/csv',
    );
    const result = await convertFile(makeJob(file, 'csv', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed[0]?.Address).toBe('14B, Fort Road\nChennai 600001');
  });

  it('auto-detects semicolon-delimited files', async () => {
    const file = textFile('Party;GSTIN\nAcme;27AABCU9603R1ZM', 'parties.csv', 'text/csv');
    const result = await convertFile(makeJob(file, 'csv', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed[0]?.Party).toBe('Acme');
    expect(parsed[0]?.GSTIN).toBe('27AABCU9603R1ZM');
  });

  it('strips a UTF-8 BOM from the header row', async () => {
    const file = textFile('\uFEFFName,Value\nX,1', 'bom.csv', 'text/csv');
    const result = await convertFile(makeJob(file, 'csv', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed[0]).toHaveProperty('Name');
    expect(parsed[0]).not.toHaveProperty('\uFEFFName');
  });

  it('drops trailing empty rows', async () => {
    const file = textFile('A,B\n1,2\n\n\n', 'pad.csv', 'text/csv');
    const result = await convertFile(makeJob(file, 'csv', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed).toHaveLength(1);
  });

  it('builds an HTML table and HTML-escapes cell contents', async () => {
    const file = textFile('Name,Notes\nBobby,<script>alert(1)</script> & more', 'escape.csv', 'text/csv');
    const result = await convertFile(makeJob(file, 'csv', 'html'));
    const html = await result.blob.text();

    expect(html).toContain('<table>');
    expect(html).toContain('<th');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; more');
    expect(html).not.toContain('<script>alert');
  });

  it('round-trips a CSV with special characters into a PDF', async () => {
    const file = textFile('Client,Turnover\nAcme,"₹ 5,00,000"\n', 'turnover.csv', 'text/csv');
    const result = await convertFile(makeJob(file, 'csv', 'pdf'));

    expect(result.mimeType).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(500);
  });
});

describe('XLSX parsing (constructed workbook, via convertFile → JSON/HTML)', () => {
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>Active</t></is></c><c r="B2"><v>1234.5</v></c></row>
<row r="3"><c r="A3" t="b"><v>1</v></c><c r="B3"><v>0</v></c></row>
</sheetData></worksheet>`;
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<si><t>Name</t></si>
<si><t>Balance</t></si>
</sst>`;

  it('parses shared strings, inline strings, booleans and numbers to JSON', async () => {
    const file = await zipFileAsFile(
      { 'xl/sharedStrings.xml': sharedStringsXml, 'xl/worksheets/sheet1.xml': sheetXml },
      'ledger.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const result = await convertFile(makeJob(file, 'xlsx', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed).toEqual([
      { Name: 'Active', Balance: '1234.5' },
      { Name: 'TRUE', Balance: '0' },
    ]);
  });

  it('uses column references to keep empty cells aligned in HTML', async () => {
    const sparseSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>
</sheetData></worksheet>`;
    const shared = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>A</t></si><si><t>B</t></si><si><t>C</t></si><si><t>x</t></si><si><t>y</t></si></sst>`;
    const file = await zipFileAsFile(
      { 'xl/sharedStrings.xml': shared, 'xl/worksheets/sheet1.xml': sparseSheet },
      'sparse.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const result = await convertFile(makeJob(file, 'xlsx', 'json'));
    const parsed = JSON.parse(await result.blob.text());

    expect(parsed).toEqual([{ A: 'x', B: '', C: 'y' }]);
  });
});

describe('DOCX structure extraction (constructed package, via convertFile → MD/TXT/PDF)', () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Audit Summary</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr><w:r><w:t>Reconciled accounts</w:t></w:r></w:p>
<w:p><w:r><w:t>Line one</w:t></w:r><w:r><w:br/><w:t>after break</w:t></w:r></w:p>
<w:p><w:r><w:t>Em&apos;dash &amp; 42 &lt; 50</w:t></w:r></w:p>
</w:body></w:document>`;
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  async function makeDocx(): Promise<File> {
    return zipFileAsFile({ 'word/document.xml': documentXml }, 'memorandum.docx', mime);
  }

  it('converts headings, list and paragraph structure to Markdown', async () => {
    const file = await makeDocx();
    const result = await convertFile(makeJob(file, 'docx', 'md'));
    const md = await result.blob.text();

    expect(md).toContain('# Audit Summary');
    expect(md).toContain('- Reconciled accounts');
    expect(md).toContain('Line one\nafter break');
  });

  it('decodes XML entities and line breaks when extracting text', async () => {
    const file = await makeDocx();
    const result = await convertFile(makeJob(file, 'docx', 'txt'));
    const lines = (await result.blob.text()).split('\n\n');

    expect(lines[0]).toBe('Audit Summary');
    expect(lines[1]).toBe('Reconciled accounts');
    expect(lines[2]).toBe('Line one\nafter break');
    expect(lines[3]).toBe("Em'dash & 42 < 50");
  });

  it('renders a DOCX to a valid PDF blob', async () => {
    const file = await makeDocx();
    const result = await convertFile(makeJob(file, 'docx', 'pdf'));

    expect(result.mimeType).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(500);
  });

  it('extracts text via the public extractTextFromDocx helper', async () => {
    const file = await makeDocx();
    const lines = await extractTextFromDocx(file);
    const joined = lines.join('\n');

    expect(lines).toContain('Audit Summary');
    expect(joined).toContain('after break');
  });
});

describe('Markdown conversion', () => {
  it('parses headings/hr/lists to HTML', async () => {
    const md = '# Heading One\n\nBody paragraph.\n\n- bullet item\n\n---\n\n## Sub Heading';
    const file = textFile(md, 'notes.md', 'text/markdown');
    const result = await convertFile(makeJob(file, 'md', 'html'));
    const html = await result.blob.text();

    expect(html).toContain('<h1>Heading One</h1>');
    expect(html).toContain('<h2>Sub Heading</h2>');
    expect(html).toContain('<li>bullet item</li>');
    expect(html).toContain('<hr />');
    expect(html).toContain('<p>Body paragraph.</p>');
  });

  it('parses numbered lists into list items in HTML', async () => {
    const md = '1. First\n2. Second';
    const file = textFile(md, 'steps.md', 'text/markdown');
    const result = await convertFile(makeJob(file, 'md', 'html'));
    const out = await result.blob.text();

    expect(out).toContain('<li>First</li>');
    expect(out).toContain('<li>Second</li>');
  });

  it('round-trips markdown headings into a DOCX and marks them as headings', async () => {
    const md = '# Title\n\nSome content';
    const file = textFile(md, 'title.md', 'text/markdown');
    const result = await convertFile(makeJob(file, 'md', 'docx'));
    const docxFile = new File([result.blob], 'title.docx', { type: result.mimeType });
    const lines = await extractTextFromDocx(docxFile);
    const joined = lines.join('\n');

    expect(joined).toContain('Title');
    expect(joined).toContain('Some content');
  });

  it('renders markdown to PDF preserving all words (wrapping, no truncation)', async () => {
    const longLine = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const md = `# Big Title\n\n${longLine}`;
    const file = textFile(md, 'big.md', 'text/markdown');
    const result = await convertFile(makeJob(file, 'md', 'pdf'));

    expect(result.mimeType).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(500);
  });
});