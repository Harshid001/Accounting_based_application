import type * as PdfjsModuleType from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextContent,
  TextItem,
} from 'pdfjs-dist/types/src/display/api';

type PdfjsModule = typeof PdfjsModuleType;

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

export interface ExtractedLine {
  text: string;
  fontSize: number;
}

export interface ExtractedPage {
  lines: ExtractedLine[];
}

export interface PdfExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
}

export async function loadPdfDocument(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: false,
    disableFontFace: true,
  });
  return loadingTask.promise;
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export async function extractTextFromPdfDocument(
  doc: PDFDocumentProxy,
): Promise<PdfExtractionResult> {
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content: TextContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    const items = content.items.filter((item): item is TextItem => 'str' in item);

    const yGroups = new Map<number, TextItem[]>();
    for (const item of items) {
      const transform = item.transform as number[];
      const y = roundTo(pageHeight - (transform[5] ?? 0), 1);
      const existing = yGroups.get(y);
      if (existing) {
        existing.push(item);
      } else {
        yGroups.set(y, [item]);
      }
    }

    const sortedYs = Array.from(yGroups.keys()).sort((a, b) => a - b);
    const lines: ExtractedLine[] = [];

    for (const y of sortedYs) {
      const groupItems = yGroups.get(y)!;
      groupItems.sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));

      let lineText = '';
      let maxFontSize = 0;
      for (const item of groupItems) {
        const transform = item.transform as number[];
        const fontSize = Math.abs(transform[3] ?? 0) || Math.abs(transform[0] ?? 0) || 12;
        if (fontSize > maxFontSize) maxFontSize = fontSize;
        lineText += item.str;
        if (item.hasEOL && !lineText.endsWith('\n')) {
          lineText += '\n';
        }
      }

      const trimmed = lineText.trim();
      if (trimmed.length > 0) {
        lines.push({ text: trimmed, fontSize: roundTo(maxFontSize, 1) });
      }
    }

    pages.push({ lines });
  }

  return { pages, totalPages: doc.numPages };
}

export async function renderPdfPageToCanvas(
  page: PDFPageProxy,
  scale: number = 4,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const width = Math.min(Math.round(viewport.width), 5000);
  const height = Math.min(Math.round(viewport.height), 5000);
  const actualScale = Math.min(
    scale,
    (width / viewport.width) * scale,
    (height / viewport.height) * scale,
  );
  const scaledViewport = page.getViewport({ scale: actualScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(scaledViewport.width);
  canvas.height = Math.round(scaledViewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d canvas context');

  await page.render({
    canvasContext: ctx,
    canvas,
    viewport: scaledViewport,
  }).promise;

  return canvas;
}

export function sanitizeForWinAnsi(text: string): string {
  return text
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[^\x20-\x7E]/g, '?');
}
