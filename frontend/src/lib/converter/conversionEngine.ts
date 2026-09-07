import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { formatBytes } from '@/lib/format';
import type {
  ConversionJob,
  ConversionResult,
  ConversionTarget,
  ImageModificationOptions,
  PdfModificationOptions,
  SupportedFormat,
} from './types';
import {
  extractTextFromPdfDocument,
  loadPdfDocument,
  renderPdfPageToCanvas,
  sanitizeForWinAnsi,
} from './pdfjs';

export const DEFAULT_IMAGE_OPTIONS: ImageModificationOptions = {
  resizeMode: 'none',
  resizePercent: 100,
  maintainAspectRatio: true,
  quality: 0.9,
  backgroundColor: 'white',
  rotate: 0,
  flipHorizontal: false,
  flipVertical: false,
  filter: 'none',
};

export const DEFAULT_PDF_OPTIONS: PdfModificationOptions = {
  pageRange: 'all',
  rotate: 0,
  compressMetadata: true,
};

export function getAvailableConversionTargets(inputFormat: SupportedFormat): ConversionTarget[] {
  switch (inputFormat) {
    case 'pdf':
      return [
        {
          id: 'docx',
          label: 'Microsoft Word (.docx)',
          extension: 'docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          description: 'Editable Word document preserving text paragraphs, headings, and structure.',
          recommendedFor: 'Editing contracts, notices, and financial reports',
        },
        {
          id: 'doc',
          label: 'Microsoft Word (.doc)',
          extension: 'doc',
          mimeType: 'application/msword',
          description: 'Legacy Microsoft Word 97-2003 compatible document.',
          recommendedFor: 'Compatibility with older office software',
        },
        {
          id: 'png',
          label: 'PNG Image (.png)',
          extension: 'png',
          mimeType: 'image/png',
          description: 'Renders PDF pages as high-resolution lossless images.',
          recommendedFor: 'Extracting clean screenshots of notices or filings',
        },
        {
          id: 'jpg',
          label: 'JPEG Image (.jpg)',
          extension: 'jpg',
          mimeType: 'image/jpeg',
          description: 'Renders PDF pages as compressed JPEG images.',
          recommendedFor: 'Uploading to government portals with image requirements',
        },
        {
          id: 'txt',
          label: 'Plain Text (.txt)',
          extension: 'txt',
          mimeType: 'text/plain',
          description: 'Extracts all readable text without formatting markup.',
          recommendedFor: 'Data extraction, copy-pasting, and text analysis',
        },
        {
          id: 'html',
          label: 'HTML Web Page (.html)',
          extension: 'html',
          mimeType: 'text/html',
          description: 'Web document formatted for browser viewing.',
        },
      ];

    case 'png':
      return [
        {
          id: 'jpg',
          label: 'JPEG / JPG Image (.jpg)',
          extension: 'jpg',
          mimeType: 'image/jpeg',
          description: 'Compressed photo format with customizable quality & white background fill for transparency.',
          recommendedFor: 'Government portals (ITR, GST, MCA) requiring JPG under size limits',
        },
        {
          id: 'webp',
          label: 'WebP Image (.webp)',
          extension: 'webp',
          mimeType: 'image/webp',
          description: 'Ultra-efficient modern web format with superior compression.',
          recommendedFor: 'Fast website loading and archiving',
        },
        {
          id: 'pdf',
          label: 'PDF Document (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'Wraps the image into a clean printable standard A4 PDF document.',
          recommendedFor: 'Formal submission of ID scans, PAN, GST certificates',
        },
        {
          id: 'png',
          label: 'Modified PNG (.png)',
          extension: 'png',
          mimeType: 'image/png',
          description: 'Resize, rotate, flip, and apply black & white document contrast filters.',
          recommendedFor: 'Clean scan cleanup and dimension adjustments',
        },
      ];

    case 'jpg':
    case 'jpeg':
      return [
        {
          id: 'png',
          label: 'PNG Image (.png)',
          extension: 'png',
          mimeType: 'image/png',
          description: 'Lossless uncompressed image format.',
          recommendedFor: 'Crisp graphics, logos, and high-fidelity archival',
        },
        {
          id: 'webp',
          label: 'WebP Image (.webp)',
          extension: 'webp',
          mimeType: 'image/webp',
          description: 'Next-generation web format with up to 40% smaller file size.',
        },
        {
          id: 'pdf',
          label: 'PDF Document (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'Converts photo or scan to standard PDF document.',
          recommendedFor: 'Client file vault storage',
        },
        {
          id: 'jpg',
          label: 'Compressed / Modified JPG (.jpg)',
          extension: 'jpg',
          mimeType: 'image/jpeg',
          description: 'Re-compress with target quality slider, resize, rotate, or enhance contrast.',
          recommendedFor: 'Downsizing large photos to fit <200 KB government limits',
        },
      ];

    case 'webp':
      return [
        {
          id: 'png',
          label: 'PNG Image (.png)',
          extension: 'png',
          mimeType: 'image/png',
          description: 'Lossless PNG image format.',
        },
        {
          id: 'jpg',
          label: 'JPEG / JPG Image (.jpg)',
          extension: 'jpg',
          mimeType: 'image/jpeg',
          description: 'Standard JPEG format for universal compatibility.',
        },
        {
          id: 'pdf',
          label: 'PDF Document (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'PDF document wrapping the image.',
        },
      ];

    case 'docx':
    case 'doc':
      return [
        {
          id: 'pdf',
          label: 'PDF Document (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'Converts Word document to formatted printable PDF.',
          recommendedFor: 'Finalizing contracts, engagement letters, and non-editable reports',
        },
        {
          id: 'txt',
          label: 'Plain Text (.txt)',
          extension: 'txt',
          mimeType: 'text/plain',
          description: 'Extracts clean unformatted text from Word document.',
        },
        {
          id: 'html',
          label: 'HTML Web Page (.html)',
          extension: 'html',
          mimeType: 'text/html',
          description: 'Converts Word document into styled HTML web page.',
        },
        {
          id: 'md',
          label: 'Markdown (.md)',
          extension: 'md',
          mimeType: 'text/markdown',
          description: 'Clean markdown format for notes and documentation.',
        },
      ];

    case 'xlsx':
    case 'csv':
      return [
        {
          id: 'pdf',
          label: 'PDF Table (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'Renders spreadsheet records as a structured, bordered PDF report.',
          recommendedFor: 'Printing bank reconciliations and ledger extracts',
        },
        {
          id: 'csv',
          label: 'CSV Spreadsheet (.csv)',
          extension: 'csv',
          mimeType: 'text/csv',
          description: 'Clean comma-separated values file.',
        },
        {
          id: 'json',
          label: 'JSON Data (.json)',
          extension: 'json',
          mimeType: 'application/json',
          description: 'Converts spreadsheet rows to structured JSON array.',
          recommendedFor: 'Importing into databases or custom financial software',
        },
        {
          id: 'html',
          label: 'HTML Table (.html)',
          extension: 'html',
          mimeType: 'text/html',
          description: 'Styled web table with alternating rows and headers.',
        },
      ];

    case 'txt':
    case 'md':
      return [
        {
          id: 'docx',
          label: 'Microsoft Word (.docx)',
          extension: 'docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          description: 'Converts text into an editable Word document with formatted paragraphs.',
        },
        {
          id: 'doc',
          label: 'Microsoft Word (.doc)',
          extension: 'doc',
          mimeType: 'application/msword',
          description: 'Word 97-2003 compatible document.',
        },
        {
          id: 'pdf',
          label: 'PDF Document (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'Formats text into clean printable A4 pages.',
        },
        {
          id: 'html',
          label: 'HTML Web Page (.html)',
          extension: 'html',
          mimeType: 'text/html',
          description: 'Converts markdown or text into styled HTML.',
        },
      ];

    default:
      return [
        {
          id: 'pdf',
          label: 'PDF Document (.pdf)',
          extension: 'pdf',
          mimeType: 'application/pdf',
          description: 'Converts file to PDF format.',
        },
        {
          id: 'txt',
          label: 'Plain Text (.txt)',
          extension: 'txt',
          mimeType: 'text/plain',
          description: 'Converts file to plain text.',
        },
      ];
  }
}

export function generateOutputFileName(
  sourceName: string,
  targetFormat: SupportedFormat,
): string {
  const dotIndex = sourceName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName;
  const targetExt = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
  return `${baseName}-converted.${targetExt}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface DocBlock {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'li' | 'hr';
  text: string;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for processing'));
    };
    img.src = url;
  });
}

export async function processImageConversion(
  file: File,
  targetFormat: SupportedFormat,
  options: ImageModificationOptions,
): Promise<{ blob: Blob; mimeType: string }> {
  if (targetFormat === 'pdf') {
    return processImageToPdf(file, options);
  }

  const img = await loadImageElement(file);
  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  let targetWidth = origWidth;
  let targetHeight = origHeight;

  if (options.resizeMode === 'percent') {
    const scale = (options.resizePercent || 100) / 100;
    targetWidth = Math.max(1, Math.round(origWidth * scale));
    targetHeight = Math.max(1, Math.round(origHeight * scale));
  } else if (options.resizeMode === 'custom') {
    if (options.customWidth && options.customHeight) {
      targetWidth = options.customWidth;
      targetHeight = options.customHeight;
    } else if (options.customWidth) {
      targetWidth = options.customWidth;
      targetHeight = options.maintainAspectRatio
        ? Math.round((options.customWidth / origWidth) * origHeight)
        : origHeight;
    } else if (options.customHeight) {
      targetHeight = options.customHeight;
      targetWidth = options.maintainAspectRatio
        ? Math.round((options.customHeight / origHeight) * origWidth)
        : origWidth;
    }
  }

  const is90or270 = options.rotate === 90 || options.rotate === 270;
  const canvasWidth = is90or270 ? targetHeight : targetWidth;
  const canvasHeight = is90or270 ? targetWidth : targetHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context');

  const isJpg = targetFormat === 'jpg' || targetFormat === 'jpeg';
  if (isJpg || options.backgroundColor !== 'transparent') {
    ctx.fillStyle = options.backgroundColor === 'black' ? '#000000' : '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  if (options.filter === 'grayscale') {
    ctx.filter = 'grayscale(100%)';
  } else if (options.filter === 'contrast') {
    ctx.filter = 'contrast(160%) brightness(105%)';
  } else if (options.filter === 'sharpen') {
    ctx.filter = 'contrast(125%) brightness(102%)';
  }

  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight / 2);

  if (options.rotate !== 0) {
    ctx.rotate((options.rotate * Math.PI) / 180);
  }

  const scaleX = options.flipHorizontal ? -1 : 1;
  const scaleY = options.flipVertical ? -1 : 1;
  ctx.scale(scaleX, scaleY);

  ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  ctx.restore();

  let mimeType = 'image/png';
  if (isJpg) mimeType = 'image/jpeg';
  else if (targetFormat === 'webp') mimeType = 'image/webp';

  const quality = Math.min(Math.max(options.quality || 0.9, 0.1), 1.0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate image blob from canvas'));
      },
      mimeType,
      isJpg || targetFormat === 'webp' ? quality : undefined,
    );
  });

  return { blob, mimeType };
}

async function processImageToPdf(
  file: File,
  options: ImageModificationOptions,
): Promise<{ blob: Blob; mimeType: string }> {
  const isJpgSource = file.type === 'image/jpeg' || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg');
  const intermediate = await processImageConversion(
    file,
    isJpgSource ? 'jpg' : 'png',
    options,
  );
  const imageBytes = await intermediate.blob.arrayBuffer();

  const pdfDoc = await PDFDocument.create();
  const embeddedImage =
    intermediate.mimeType === 'image/jpeg'
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes);

  const a4Width = 595.28;
  const a4Height = 841.89;
  const margin = 36;

  const maxW = a4Width - margin * 2;
  const maxH = a4Height - margin * 2;

  const imgW = embeddedImage.width;
  const imgH = embeddedImage.height;

  const scale = Math.min(maxW / imgW, maxH / imgH, 1.0);
  const renderW = imgW * scale;
  const renderH = imgH * scale;

  const page = pdfDoc.addPage([a4Width, a4Height]);
  const posX = (a4Width - renderW) / 2;
  const posY = (a4Height - renderH) / 2;

  page.drawImage(embeddedImage, {
    x: posX,
    y: posY,
    width: renderW,
    height: renderH,
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  return { blob, mimeType: 'application/pdf' };
}

function parsePageRange(spec: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = spec.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]!, 10);
      const end = parseInt(rangeMatch[2]!, 10);
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        if (i >= 1) pages.add(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (num >= 1 && num <= totalPages) pages.add(num);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

async function getPdfPages(
  file: File,
  pdfOptions?: PdfModificationOptions,
): Promise<{ doc: Awaited<ReturnType<typeof loadPdfDocument>>; pageIndexes: number[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await loadPdfDocument(arrayBuffer);
  let pageIndexes: number[];

  if (!pdfOptions || pdfOptions.pageRange === 'all') {
    pageIndexes = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  } else if (pdfOptions.pageRange === 'first') {
    pageIndexes = [1];
  } else if (pdfOptions.pageRange === 'custom' && pdfOptions.customPages) {
    pageIndexes = parsePageRange(pdfOptions.customPages, doc.numPages);
    if (pageIndexes.length === 0) {
      pageIndexes = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    }
  } else {
    pageIndexes = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  }

  return { doc, pageIndexes };
}

export async function extractTextFromPdf(pdfBytes: ArrayBuffer): Promise<string[]> {
  try {
    const doc = await loadPdfDocument(pdfBytes);
    const result = await extractTextFromPdfDocument(doc);
    const lines: string[] = [];
    for (const page of result.pages) {
      for (const line of page.lines) {
        lines.push(line.text);
      }
    }
    if (lines.length === 0) {
      lines.push('PDF Document');
      lines.push(`${result.totalPages} page(s)`);
    }
    return lines;
  } catch {
    return ['PDF Document', 'Converted content from portable document format.'];
  }
}

async function extractBlocksFromPdf(file: File): Promise<DocBlock[]> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await loadPdfDocument(arrayBuffer);
  const result = await extractTextFromPdfDocument(doc);
  const blocks: DocBlock[] = [];

  for (const page of result.pages) {
    for (const line of page.lines) {
      const isHeading = line.fontSize >= 14 || (line.text.length < 60 && /^[A-Z0-9\s:.]+$/.test(line.text));
      if (isHeading && line.fontSize >= 18) {
        blocks.push({ type: 'h1', text: line.text });
      } else if (isHeading && line.fontSize >= 14) {
        blocks.push({ type: 'h2', text: line.text });
      } else if (isHeading) {
        blocks.push({ type: 'h3', text: line.text });
      } else {
        blocks.push({ type: 'p', text: line.text });
      }
    }
  }

  return blocks;
}

async function processPdfToDocx(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const blocks = await extractBlocksFromPdf(file);

  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: file.name.replace(/\.[^/.]+$/, ''),
          bold: true,
          size: 32,
          font: 'Calibri',
          color: '1E3A8A',
        }),
      ],
    }),
  );

  for (const block of blocks) {
    if (block.type === 'h1') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 120 },
          children: [new TextRun({ text: block.text, bold: true, size: 32, font: 'Calibri', color: '1E3A8A' })],
        }),
      );
    } else if (block.type === 'h2') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: block.text, bold: true, size: 26, font: 'Calibri', color: '1E40AF' })],
        }),
      );
    } else if (block.type === 'h3') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: block.text, bold: true, size: 24, font: 'Calibri', color: '1E40AF' })],
        }),
      );
    } else if (block.type === 'li') {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: block.text, size: 22, font: 'Calibri', color: '1F2937' })],
        }),
      );
    } else if (block.type === 'hr') {
      paragraphs.push(
        new Paragraph({
          border: { bottom: { style: 'single', size: 6, color: 'CBD5E1' } },
          spacing: { before: 120, after: 120 },
          children: [],
        }),
      );
    } else {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 140 },
          children: [new TextRun({ text: block.text, size: 22, font: 'Calibri', color: '1F2937' })],
        }),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return {
    blob,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

async function processPdfToDoc(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const blocks = await extractBlocksFromPdf(file);

  const bodyContent = blocks
    .map((block) => {
      if (block.type === 'hr') return '<hr />';
      if (block.type.startsWith('h')) {
        const level = parseInt(block.type[1]!, 10);
        const sizes: Record<number, string> = { 1: '18pt', 2: '14pt', 3: '13pt', 4: '12pt', 5: '11pt', 6: '10pt' };
        return `<h${level} style="color: #1e3a8a; margin-top: 16pt; margin-bottom: 6pt; font-size: ${sizes[level] || '12pt'};">${escapeHtml(block.text)}</h${level}>`;
      }
      if (block.type === 'li') return `<li>${escapeHtml(block.text)}</li>`;
      return `<p style="margin-bottom: 8pt; font-size: 11pt; color: #1f2937;">${escapeHtml(block.text)}</p>`;
    })
    .join('\n');

  const docHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${escapeHtml(file.name)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { size: A4; margin: 1in; }
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; line-height: 1.5; }
  </style>
</head>
<body>
  <h1 style="color: #1e3a8a; text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 8pt;">
    ${escapeHtml(file.name.replace(/\.[^/.]+$/, ''))}
  </h1>
  ${bodyContent}
</body>
</html>
  `.trim();

  const blob = new Blob([docHtml], { type: 'application/msword' });
  return { blob, mimeType: 'application/msword' };
}

async function processPdfToImages(
  file: File,
  targetFormat: 'png' | 'jpg',
  pdfOptions?: PdfModificationOptions,
): Promise<{ blob: Blob; mimeType: string }> {
  const { doc, pageIndexes } = await getPdfPages(file, pdfOptions);
  const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';

  if (pageIndexes.length === 1) {
    const page = await doc.getPage(pageIndexes[0]!);
    const canvas = await renderPdfPageToCanvas(page, 4);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to convert PDF page to image blob'));
        },
        mime,
        targetFormat === 'jpg' ? 0.92 : undefined,
      );
    });
    return { blob, mimeType: mime };
  }

  const zip = new JSZip();
  for (let i = 0; i < pageIndexes.length; i++) {
    const pageNum = pageIndexes[i]!;
    const page = await doc.getPage(pageNum);
    const canvas = await renderPdfPageToCanvas(page, 4);
    const imageData = canvas.toDataURL(mime, targetFormat === 'jpg' ? 0.92 : undefined);
    const base64 = imageData.split(',')[1]!;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    zip.file(`${baseName}_page_${pageNum}.${targetFormat === 'jpg' ? 'jpg' : 'png'}`, base64, { base64: true });
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { blob: zipBlob, mimeType: 'application/zip' };
}

async function processPdfToTxt(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const blocks = await extractBlocksFromPdf(file);
  const text = blocks.map((b) => b.text).join('\n\n');
  const blob = new Blob([text], { type: 'text/plain' });
  return { blob, mimeType: 'text/plain' };
}

async function processPdfToHtml(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const blocks = await extractBlocksFromPdf(file);
  const bodyContent = blocks
    .map((block) => {
      if (block.type === 'hr') return '<hr />';
      if (block.type.startsWith('h')) return `<${block.type}>${escapeHtml(block.text)}</${block.type}>`;
      if (block.type === 'li') return `<li>${escapeHtml(block.text)}</li>`;
      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto;line-height:1.6;}</style></head><body>${bodyContent}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  return { blob, mimeType: 'text/html' };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export async function extractTextFromDocx(file: File): Promise<string[]> {
  const blocks = await extractBlocksFromDocx(file);
  return blocks.map((b) => b.text);
}

async function extractBlocksFromDocx(file: File): Promise<DocBlock[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    if (!documentXml) return [{ type: 'p', text: file.name.replace(/\.[^/.]+$/, '') }];

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'application/xml');
    const blocks: DocBlock[] = [];

    const pElements = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p');

    for (let i = 0; i < pElements.length; i++) {
      const pEl = pElements[i]!;
      let pStyle = '';
      const pPr = pEl.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'pPr')[0];
      if (pPr) {
        const pStyleEl = pPr.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'pStyle')[0];
        if (pStyleEl) {
          pStyle = pStyleEl.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val') || '';
        }
      }

      let text = '';
      const runs = pEl.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'r');
      for (let j = 0; j < runs.length; j++) {
        const run = runs[j]!;
        const brs = run.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'br');
        for (let k = 0; k < brs.length; k++) {
          text += '\n';
        }
        const tabs = run.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'tab');
        for (let k = 0; k < tabs.length; k++) {
          text += '    ';
        }
        const tEls = run.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
        for (let k = 0; k < tEls.length; k++) {
          text += tEls[k]!.textContent || '';
        }
      }

      text = decodeXmlEntities(text).trim();
      if (!text && !pStyle) continue;

      const headingMatch = pStyle.match(/^Heading(\d)$/i);
      if (headingMatch) {
        const level = Math.min(parseInt(headingMatch[1]!, 10), 6) as 1 | 2 | 3 | 4 | 5 | 6;
        blocks.push({ type: `h${level}` as DocBlock['type'], text });
      } else if (pStyle.toLowerCase().includes('list')) {
        blocks.push({ type: 'li', text });
      } else if (text) {
        blocks.push({ type: 'p', text });
      }
    }

    return blocks.length > 0 ? blocks : [{ type: 'p', text: file.name.replace(/\.[^/.]+$/, '') }];
  } catch {
    return [{ type: 'p', text: file.name.replace(/\.[^/.]+$/, '') }, { type: 'p', text: 'Document contents' }];
  }
}

function wrapText(font: Awaited<ReturnType<PDFDocument['embedFont']>>, text: string, fontSize: number, maxWidth: number): string[] {
  const sanitized = sanitizeForWinAnsi(text);
  const words = sanitized.split(/\s+/);
  const wrapped: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (textWidth > maxWidth && currentLine) {
      wrapped.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) wrapped.push(currentLine);
  return wrapped.length > 0 ? wrapped : [''];
}

async function processDocxToPdf(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const blocks = await extractBlocksFromDocx(file);
  return renderBlocksToPdf(blocks, file.name);
}

async function renderBlocksToPdf(blocks: DocBlock[], sourceName: string): Promise<{ blob: Blob; mimeType: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const a4Width = 595.28;
  const a4Height = 841.89;
  const margin = 50;
  const maxWidth = a4Width - margin * 2;

  let page = pdfDoc.addPage([a4Width, a4Height]);
  let y = a4Height - margin;

  const title = sanitizeForWinAnsi(sourceName.replace(/\.[^/.]+$/, ''));
  page.drawText(title, {
    x: margin,
    y: y - 10,
    size: 18,
    font: fontBold,
    color: rgb(0.12, 0.23, 0.54),
  });
  y -= 45;

  page.drawLine({
    start: { x: margin, y },
    end: { x: a4Width - margin, y },
    thickness: 1.5,
    color: rgb(0.8, 0.85, 0.9),
  });
  y -= 25;

  for (const block of blocks) {
    if (block.type === 'hr') {
      if (y < margin + 20) {
        page = pdfDoc.addPage([a4Width, a4Height]);
        y = a4Height - margin;
      }
      page.drawLine({
        start: { x: margin, y },
        end: { x: a4Width - margin, y },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 20;
      continue;
    }

    const isHeading = block.type.startsWith('h');
    const headingLevel = isHeading ? parseInt(block.type[1]!, 10) : 0;
    const fontSizes: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 12, 5: 11, 6: 10 };
    const fontSize = isHeading ? (fontSizes[headingLevel] || 11) : 10;
    const currentFont = isHeading ? fontBold : font;
    const color = isHeading ? rgb(0.12, 0.23, 0.54) : rgb(0.15, 0.18, 0.22);
    const lineHeight = fontSize + 4;
    const indent = block.type === 'li' ? 20 : 0;

    if (isHeading) y -= 8;

    const wrappedLines = wrapText(font, block.text, fontSize, maxWidth - indent);
    for (const line of wrappedLines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([a4Width, a4Height]);
        y = a4Height - margin;
      }
      if (block.type === 'li') {
        page.drawText('\u2022', {
          x: margin,
          y,
          size: fontSize,
          font: currentFont,
          color,
        });
      }
      page.drawText(line, {
        x: margin + indent,
        y,
        size: fontSize,
        font: currentFont,
        color,
      });
      y -= lineHeight;
    }

    if (isHeading) y -= 4;
    else y -= 4;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  return { blob, mimeType: 'application/pdf' };
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && char in counts) counts[char]!++;
  }
  let best = ',';
  let max = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = delim;
    }
  }
  return best;
}

function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(cleaned);
  const rows: string[][] = [];
  let row: string[] = [];
  let token = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]!;
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        token += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        token += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(token);
        token = '';
      } else if (char === '\r' && next === '\n') {
        row.push(token);
        token = '';
        rows.push(row);
        row = [];
        i++;
      } else if (char === '\n' || char === '\r') {
        row.push(token);
        token = '';
        rows.push(row);
        row = [];
      } else {
        token += char;
      }
    }
  }

  row.push(token);
  if (row.length > 0 && row.some((c) => c.length > 0)) {
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0 && r.some((cell) => cell.length > 0));
}

async function parseXlsx(file: File): Promise<string[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('text');
  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const parser = new DOMParser();
    const ssDoc = parser.parseFromString(sharedStringsXml, 'application/xml');
    const siEls = ssDoc.getElementsByTagName('si');
    for (let i = 0; i < siEls.length; i++) {
      const tEls = siEls[i]!.getElementsByTagName('t');
      let text = '';
      for (let j = 0; j < tEls.length; j++) {
        text += tEls[j]!.textContent || '';
      }
      sharedStrings.push(text);
    }
  }

  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('text');
  if (!sheetXml) return [];

  const parser = new DOMParser();
  const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');
  const rowEls = sheetDoc.getElementsByTagName('row');
  const rows: string[][] = [];

  for (let i = 0; i < rowEls.length; i++) {
    const rowEl = rowEls[i]!;
    const cellEls = rowEl.getElementsByTagName('c');
    const row: string[] = [];
    let maxCol = 0;

    for (let j = 0; j < cellEls.length; j++) {
      const cell = cellEls[j]!;
      const ref = cell.getAttribute('r') || '';
      const colMatch = ref.match(/^[A-Z]+/);
      if (!colMatch) continue;
      const colStr = colMatch[0];
      let colIdx = 0;
      for (let k = 0; k < colStr.length; k++) {
        colIdx = colIdx * 26 + (colStr.charCodeAt(k) - 64);
      }
      colIdx -= 1;
      if (colIdx > maxCol) maxCol = colIdx;

      const type = cell.getAttribute('t') || '';
      const vEl = cell.getElementsByTagName('v')[0];
      const vText = vEl?.textContent || '';

      let value = '';
      if (type === 's') {
        const idx = parseInt(vText, 10);
        value = sharedStrings[idx] || '';
      } else if (type === 'inlineStr') {
        const isEls = cell.getElementsByTagName('is');
        if (isEls.length > 0) {
          const tEls = isEls[0]!.getElementsByTagName('t');
          for (let k = 0; k < tEls.length; k++) {
            value += tEls[k]!.textContent || '';
          }
        }
      } else if (type === 'b') {
        value = vText === '1' ? 'TRUE' : 'FALSE';
      } else {
        value = vText;
      }

      while (row.length <= colIdx) row.push('');
      row[colIdx] = value;
    }

    while (row.length <= maxCol) row.push('');
    rows.push(row);
  }

  return rows;
}

async function getSpreadsheetRows(file: File, format: SupportedFormat): Promise<string[][]> {
  if (format === 'xlsx') {
    return parseXlsx(file);
  }
  const text = await file.text();
  return parseCsv(text);
}

async function processSpreadsheetConversion(
  file: File,
  inputFormat: SupportedFormat,
  targetFormat: SupportedFormat,
): Promise<{ blob: Blob; mimeType: string }> {
  const rows = await getSpreadsheetRows(file, inputFormat);

  if (targetFormat === 'json') {
    if (rows.length === 0) {
      const blob = new Blob(['[]'], { type: 'application/json' });
      return { blob, mimeType: 'application/json' };
    }
    const headers = (rows[0] ?? []).map((h, i) => h || `column_${i + 1}`);
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      return obj;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    return { blob, mimeType: 'application/json' };
  }

  if (targetFormat === 'csv') {
    const csvLines = rows.map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(','),
    );
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    return { blob, mimeType: 'text/csv' };
  }

  if (targetFormat === 'html') {
    const tableHeaders = (rows[0] || [])
      .map((h) => `<th style="padding: 10px; background: #1e3a8a; color: white; text-align: left; border: 1px solid #d1d5db;">${escapeHtml(h)}</th>`)
      .join('');
    const tableRows = rows
      .slice(1)
      .map(
        (row, idx) =>
          `<tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">` +
          row.map((cell) => `<td style="padding: 8px 10px; border: 1px solid #e5e7eb;">${escapeHtml(cell)}</td>`).join('') +
          '</tr>',
      )
      .join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(file.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  </style>
</head>
<body>
  <h2>${escapeHtml(file.name.replace(/\.[^/.]+$/, ''))}</h2>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>
    `.trim();
    const blob = new Blob([html], { type: 'text/html' });
    return { blob, mimeType: 'text/html' };
  }

  if (targetFormat === 'pdf') {
    return renderSpreadsheetToPdf(rows, file.name);
  }

  const text = await file.text();
  const blob = new Blob([text], { type: 'text/csv' });
  return { blob, mimeType: 'text/csv' };
}

async function renderSpreadsheetToPdf(rows: string[][], sourceName: string): Promise<{ blob: Blob; mimeType: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const a4W = 841.89;
  const a4H = 595.28;
  const margin = 40;
  const rowH = 22;
  const headerFontSize = 9;
  const cellFontSize = 8;

  let page = pdfDoc.addPage([a4W, a4H]);
  let y = a4H - margin;

  const title = sanitizeForWinAnsi(sourceName.replace(/\.[^/.]+$/, ''));
  page.drawText(title, {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.23, 0.54),
  });
  y -= 30;

  const colCount = Math.max(1, Math.min(rows[0]?.length || 4, 10));
  const tableW = a4W - margin * 2;
  const colW = tableW / colCount;

  for (let r = 0; r < rows.length; r++) {
    if (y < margin + rowH) {
      page = pdfDoc.addPage([a4W, a4H]);
      y = a4H - margin;
    }

    const isHeader = r === 0;
    const row = rows[r]!;

    page.drawRectangle({
      x: margin,
      y: y - rowH + 6,
      width: tableW,
      height: rowH,
      color: isHeader ? rgb(0.9, 0.94, 1.0) : r % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1),
    });

    for (let c = 0; c < colCount; c++) {
      const rawText = row[c] || '';
      const sanitized = sanitizeForWinAnsi(rawText);
      const maxChars = Math.floor(colW / (isHeader ? 5.5 : 4.5));
      const displayText = sanitized.length > maxChars ? sanitized.slice(0, maxChars - 1) + '\u2026' : sanitized;
      page.drawText(displayText, {
        x: margin + c * colW + 6,
        y: y - 8,
        size: isHeader ? headerFontSize : cellFontSize,
        font: isHeader ? fontBold : font,
        color: isHeader ? rgb(0.12, 0.23, 0.54) : rgb(0.15, 0.18, 0.22),
      });
    }
    y -= rowH;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  return { blob, mimeType: 'application/pdf' };
}

function parseMarkdownToBlocks(text: string): DocBlock[] {
  const lines = text.split(/\r\n|\r|\n/);
  const blocks: DocBlock[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: `h${level}`, text: headingMatch[2]!.trim() });
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr', text: '' });
      continue;
    }

    const listMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (listMatch) {
      blocks.push({ type: 'li', text: listMatch[1]!.trim() });
      continue;
    }

    const numListMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numListMatch) {
      blocks.push({ type: 'li', text: numListMatch[1]!.trim() });
      continue;
    }

    if (line.trim().length === 0) {
      continue;
    }

    blocks.push({ type: 'p', text: line.trim() });
  }

  return blocks;
}

function blocksToMarkdown(blocks: DocBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type.startsWith('h')) {
        const level = parseInt(block.type[1]!, 10);
        return '#'.repeat(level) + ' ' + block.text;
      }
      if (block.type === 'li') return '- ' + block.text;
      if (block.type === 'hr') return '---';
      return block.text;
    })
    .join('\n\n');
}

function blocksToHtml(blocks: DocBlock[]): string {
  const body = blocks
    .map((block) => {
      if (block.type === 'hr') return '<hr />';
      if (block.type.startsWith('h')) return `<${block.type}>${escapeHtml(block.text)}</${block.type}>`;
      if (block.type === 'li') return `<li>${escapeHtml(block.text)}</li>`;
      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto;line-height:1.6;}</style></head><body>\n${body}\n</body></html>`;
}

async function processTextConversion(
  file: File,
  targetFormat: SupportedFormat,
): Promise<{ blob: Blob; mimeType: string }> {
  const text = await file.text();
  const isMd = file.name.endsWith('.md') || file.type === 'text/markdown';
  const blocks = isMd ? parseMarkdownToBlocks(text) : text.split(/\r\n|\r|\n/).filter((l) => l.trim()).map((l) => ({ type: 'p' as const, text: l.trim() }));

  if (targetFormat === 'docx') {
    const paragraphs = blocks.map((block) => {
      const isHeading = block.type.startsWith('h');
      const headingMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        h1: HeadingLevel.HEADING_1,
        h2: HeadingLevel.HEADING_2,
        h3: HeadingLevel.HEADING_3,
        h4: HeadingLevel.HEADING_4,
        h5: HeadingLevel.HEADING_5,
        h6: HeadingLevel.HEADING_6,
      };
      const heading = headingMap[block.type];
      const opts: ConstructorParameters<typeof Paragraph>[0] = {
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: block.text,
            size: isHeading ? 26 : 22,
            font: 'Calibri',
            bold: isHeading,
          }),
        ],
        ...(heading ? { heading } : {}),
        ...(block.type === 'li' ? { bullet: { level: 0 } } : {}),
      };
      return new Paragraph(opts);
    });
    const doc = new Document({
      sections: [{ children: paragraphs }],
    });
    const blob = await Packer.toBlob(doc);
    return {
      blob,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  if (targetFormat === 'pdf') {
    return renderBlocksToPdf(blocks, file.name);
  }

  if (targetFormat === 'html') {
    const html = blocksToHtml(blocks);
    const blob = new Blob([html], { type: 'text/html' });
    return { blob, mimeType: 'text/html' };
  }

  if (targetFormat === 'md') {
    const md = isMd ? text : blocksToMarkdown(blocks);
    const blob = new Blob([md], { type: 'text/markdown' });
    return { blob, mimeType: 'text/markdown' };
  }

  const blob = new Blob([text], { type: 'text/plain' });
  return { blob, mimeType: 'text/plain' };
}

async function processDocxToMd(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const blocks = await extractBlocksFromDocx(file);
  const md = blocksToMarkdown(blocks);
  const blob = new Blob([md], { type: 'text/markdown' });
  return { blob, mimeType: 'text/markdown' };
}

export async function convertFile(
  job: ConversionJob,
  onProgress?: (percent: number, status: string) => void,
): Promise<ConversionResult> {
  const { sourceFile, userOverrideFormat, targetFormat, imageOptions, pdfOptions } = job;
  const inputFormat = userOverrideFormat || job.scanResult.detectedFormat;

  onProgress?.(15, 'Preparing document for conversion...');

  let resultBlob: Blob;
  let resultMime: string;

  if (['png', 'jpg', 'jpeg', 'webp'].includes(inputFormat)) {
    onProgress?.(45, `Processing image and converting to ${targetFormat.toUpperCase()}...`);
    const processed = await processImageConversion(sourceFile, targetFormat, imageOptions);
    resultBlob = processed.blob;
    resultMime = processed.mimeType;
  } else if (inputFormat === 'pdf') {
    onProgress?.(40, 'Analyzing PDF structure and extracting content...');
    if (targetFormat === 'docx') {
      const res = await processPdfToDocx(sourceFile);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else if (targetFormat === 'doc') {
      const res = await processPdfToDoc(sourceFile);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else if (targetFormat === 'png' || targetFormat === 'jpg') {
      const res = await processPdfToImages(sourceFile, targetFormat, pdfOptions);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else if (targetFormat === 'txt') {
      const res = await processPdfToTxt(sourceFile);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else if (targetFormat === 'html') {
      const res = await processPdfToHtml(sourceFile);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else {
      resultBlob = sourceFile;
      resultMime = sourceFile.type;
    }
  } else if (inputFormat === 'docx' || inputFormat === 'doc') {
    onProgress?.(40, 'Reading Word document elements...');
    if (targetFormat === 'pdf') {
      const res = await processDocxToPdf(sourceFile);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else if (targetFormat === 'txt') {
      const lines = await extractTextFromDocx(sourceFile);
      resultBlob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
      resultMime = 'text/plain';
    } else if (targetFormat === 'html') {
      const blocks = await extractBlocksFromDocx(sourceFile);
      const html = blocksToHtml(blocks);
      resultBlob = new Blob([html], { type: 'text/html' });
      resultMime = 'text/html';
    } else if (targetFormat === 'md') {
      const res = await processDocxToMd(sourceFile);
      resultBlob = res.blob;
      resultMime = res.mimeType;
    } else {
      resultBlob = sourceFile;
      resultMime = sourceFile.type;
    }
  } else if (inputFormat === 'csv' || inputFormat === 'xlsx') {
    onProgress?.(50, `Formatting spreadsheet into ${targetFormat.toUpperCase()}...`);
    const res = await processSpreadsheetConversion(sourceFile, inputFormat, targetFormat);
    resultBlob = res.blob;
    resultMime = res.mimeType;
  } else {
    onProgress?.(50, `Converting text to ${targetFormat.toUpperCase()}...`);
    const res = await processTextConversion(sourceFile, targetFormat);
    resultBlob = res.blob;
    resultMime = res.mimeType;
  }

  onProgress?.(90, 'Finalizing converted file...');

  const outputFileName = generateOutputFileName(sourceFile.name, targetFormat);

  let previewUrl: string | undefined;
  if (resultMime.startsWith('image/')) {
    previewUrl = URL.createObjectURL(resultBlob);
  }

  let previewText: string | undefined;
  if (resultMime.includes('text') || resultMime.includes('json')) {
    try {
      previewText = (await resultBlob.slice(0, 500).text()).slice(0, 300);
    } catch {
      // Preview extraction is best-effort; leave it unset on failure.
    }
  }

  onProgress?.(100, 'Conversion completed successfully!');

  return {
    blob: resultBlob,
    outputFileName,
    outputSizeBytes: resultBlob.size,
    outputSizeFormatted: formatBytes(resultBlob.size),
    mimeType: resultMime,
    targetFormat,
    previewUrl,
    previewText,
  };
}
