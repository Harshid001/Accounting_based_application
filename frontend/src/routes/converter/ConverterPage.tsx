import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Download,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderCheck,
  HelpCircle,
  ImageIcon,
  Loader2,
  RotateCw,
  Sliders,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/cn';
import {
  convertFile,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  getAvailableConversionTargets,
} from '@/lib/converter/conversionEngine';
import { scanFile, SUPPORTED_FORMAT_METAS } from '@/lib/converter/fileScanner';
import type {
  ConversionResult,
  FileScanResult,
  ImageModificationOptions,
  PdfModificationOptions,
  SupportedFormat,
} from '@/lib/converter/types';
import { SaveToVaultDialog } from './components/SaveToVaultDialog';

export function ConverterPage() {
  usePageTitle('File Converter & Modifier');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workflow State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<FileScanResult | null>(null);
  const [userOverrideFormat, setUserOverrideFormat] = useState<SupportedFormat | null>(null);
  const [selectedTargetFormat, setSelectedTargetFormat] = useState<SupportedFormat | null>(null);

  // Modification Options
  const [imageOptions, setImageOptions] = useState<ImageModificationOptions>(DEFAULT_IMAGE_OPTIONS);
  const [pdfOptions, setPdfOptions] = useState<PdfModificationOptions>(DEFAULT_PDF_OPTIONS);

  // Conversion Execution State
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionStatusText, setConversionStatusText] = useState('');
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);

  // Dialog State
  const [saveVaultDialogOpen, setSaveVaultDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Active Input Format (User override takes precedence over auto-detected)
  const activeInputFormat: SupportedFormat =
    userOverrideFormat || scanResult?.detectedFormat || 'pdf';

  // Available conversion targets for current active format
  const availableTargets = useMemo(
    () => getAvailableConversionTargets(activeInputFormat),
    [activeInputFormat],
  );

  // Active target format derived cleanly without cascading render effects
  const activeTargetFormat: SupportedFormat = useMemo(() => {
    if (selectedTargetFormat && availableTargets.some((t) => t.id === selectedTargetFormat)) {
      return selectedTargetFormat;
    }
    return availableTargets[0]?.id ?? 'docx';
  }, [availableTargets, selectedTargetFormat]);

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setConversionResult(null);

    try {
      const result = await scanFile(file);
      setScanResult(result);
      setUserOverrideFormat(result.detectedFormat);

      // Auto pick sensible defaults
      if (result.dimensions) {
        const { width, height } = result.dimensions;
        setImageOptions((prev) => ({
          ...prev,
          customWidth: width,
          customHeight: height,
        }));
      }
    } catch {
      toast({
        tone: 'info',
        title: 'Inspection Note',
        description: 'Using standard file defaults for processing.',
      });
    }
  }, [toast]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.item?.(0) ?? e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  // Run conversion
  const handleConvert = async () => {
    if (!selectedFile || !scanResult || !activeTargetFormat) return;

    setIsConverting(true);
    setConversionProgress(10);
    setConversionStatusText('Starting conversion...');

    try {
      const result = await convertFile(
        {
          sourceFile: selectedFile,
          scanResult,
          userOverrideFormat: activeInputFormat,
          targetFormat: activeTargetFormat,
          imageOptions,
          pdfOptions,
        },
        (progress, status) => {
          setConversionProgress(progress);
          setConversionStatusText(status);
        },
      );

      setConversionResult(result);
      toast({
        tone: 'success',
        title: 'Conversion Complete',
        description: `Successfully converted "${selectedFile.name}" to ${result.outputFileName}`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Conversion Failed',
        description: err instanceof Error ? err.message : 'An error occurred during file processing.',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Instant local download
  const handleDownload = () => {
    if (!conversionResult) return;
    const url = URL.createObjectURL(conversionResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = conversionResult.outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset converter
  const handleReset = () => {
    setSelectedFile(null);
    setScanResult(null);
    setUserOverrideFormat(null);
    setConversionResult(null);
    setImageOptions(DEFAULT_IMAGE_OPTIONS);
    setPdfOptions(DEFAULT_PDF_OPTIONS);
  };

  const isImageActive = ['png', 'jpg', 'jpeg', 'webp'].includes(activeInputFormat) ||
    ['png', 'jpg', 'jpeg', 'webp'].includes(activeTargetFormat);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="File Converter & Modifier"
        description="Convert documents and images (PDF to Word, PNG to JPG, Word to PDF, CSV to JSON) with live inspection, user format override, and client vault integration."
      />

      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3 shadow-2xs">
        <span className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--fd-text-tertiary)]">
          <Sparkles size={13} className="text-[var(--fd-accent)]" />
          Popular Presets:
        </span>

        <button
          type="button"
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]"
        >
          <FileText size={12} className="text-[var(--fd-status-danger)]" />
          <span>PDF to Word (DOCX)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]"
        >
          <ImageIcon size={12} className="text-[var(--fd-status-progress)]" />
          <span>PNG to JPG (White BG)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]"
        >
          <ArrowRightLeft size={12} className="text-[var(--fd-accent)]" />
          <span>JPG to PNG (Lossless)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]"
        >
          <FileCheck size={12} className="text-[var(--fd-status-done)]" />
          <span>Image to PDF</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]"
        >
          <FileSpreadsheet size={12} className="text-[var(--fd-status-confirmed)]" />
          <span>CSV to PDF / JSON</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        data-testid="file-input"
        aria-label="Upload file to convert"
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          const file = files?.item?.(0) ?? files?.[0];
          if (file) {
            void handleFile(file);
          }
        }}
      />

      {/* Main Workflow Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Step 1 (Upload & Scan) + Step 2 (Target & Options) */}
        <div className="space-y-6 lg:col-span-7">
          {/* STEP 1: UPLOAD & SCAN */}
          <Card className="overflow-hidden border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fd-accent)] text-xs font-bold text-white">
                  1
                </span>
                <h3 className="text-base font-semibold text-[var(--fd-text-primary)]">
                  Import & File Scanner
                </h3>
              </div>
              {selectedFile && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-[var(--fd-text-secondary)]">
                  <X size={12} className="mr-1" />
                  Clear File
                </Button>
              )}
            </div>

            {!selectedFile ? (
              <div
                role="button"
                data-testid="file-dropzone"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer',
                  isDragging
                    ? 'border-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)] scale-[1.01]'
                    : 'border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] hover:border-[var(--fd-accent)] hover:bg-[var(--fd-surface-3)]',
                )}
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fd-surface-1)] shadow-sm text-[var(--fd-accent)]">
                  <UploadCloud size={28} />
                </div>
                <h4 className="text-sm font-semibold text-[var(--fd-text-primary)]">
                  Drag and drop your file here, or click to browse
                </h4>
                <p className="mt-1 text-xs text-[var(--fd-text-secondary)]">
                  Supports PDF, Word (DOCX/DOC), Images (PNG, JPG, WEBP), Excel (XLSX, CSV), and Text
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Badge tone="accent" className="text-[10px]">Confidential (Browser Processed)</Badge>
                  <Badge tone="neutral" className="text-[10px]">Instant & Unlimited</Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Inspection Card */}
                <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--fd-accent-subtle-bg)] text-[var(--fd-accent)]">
                        {scanResult?.detectedFormat === 'pdf' ? (
                          <FileText size={20} />
                        ) : ['png', 'jpg', 'jpeg', 'webp'].includes(scanResult?.detectedFormat || '') ? (
                          <ImageIcon size={20} />
                        ) : (
                          <FileCode size={20} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-[var(--fd-text-primary)]" title={selectedFile.name}>
                          {selectedFile.name}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fd-text-secondary)]">
                          <span>{scanResult?.fileSizeFormatted || 'Calculating...'}</span>
                          <span>•</span>
                          <span>{selectedFile.type || 'Raw binary'}</span>
                        </div>
                      </div>
                    </div>

                    <Badge tone="accent" className="shrink-0 text-xs">
                      {SUPPORTED_FORMAT_METAS[scanResult?.detectedFormat || 'pdf']?.label || 'Detected'}
                    </Badge>
                  </div>

                  {/* Deep scan inspection results */}
                  {scanResult && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--fd-border-subtle)] pt-3 text-xs">
                      <div>
                        <span className="text-[var(--fd-text-tertiary)]">Magic Signature:</span>{' '}
                        <span className={cn('font-medium', scanResult.magicMatch ? 'text-[var(--fd-status-done)]' : 'text-[var(--fd-status-waiting)]')}>
                          {scanResult.magicMatch ? 'Verified Header' : 'Extension Matched'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--fd-text-tertiary)]">Details:</span>{' '}
                        <span className="font-medium text-[var(--fd-text-primary)]">
                          {scanResult.integrityNotes || 'Standard document'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* USER FORMAT CONFIRMATION / OVERRIDE SELECTOR */}
                <div className="rounded-xl border border-[var(--fd-status-progress)]/30 bg-[var(--fd-status-progress)]/10 p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="user-override-select"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fd-text-primary)]"
                    >
                      <Sliders size={13} className="text-[var(--fd-status-progress)]" />
                      Imported File Type (User Confirmation & Override):
                    </label>
                    <span className="text-[10px] text-[var(--fd-text-secondary)]">
                      Auto-detected: {SUPPORTED_FORMAT_METAS[scanResult?.detectedFormat || 'pdf']?.label}
                    </span>
                  </div>

                  <p className="mb-2.5 text-[11px] text-[var(--fd-text-secondary)] leading-relaxed">
                    You have complete control over how FirmDesk interprets this file. If the file has a different format or custom extension, select the exact format below:
                  </p>

                  <select
                    id="user-override-select"
                    value={activeInputFormat}
                    onChange={(e) => {
                      const next = e.target.value as SupportedFormat;
                      setUserOverrideFormat(next);
                      toast({
                        tone: 'info',
                        title: 'Import Format Updated',
                        description: `Now treating input file as ${SUPPORTED_FORMAT_METAS[next]?.label}`,
                      });
                    }}
                    className="flex h-9 w-full rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-3 text-xs font-medium text-[var(--fd-text-primary)] outline-none focus:border-[var(--fd-accent)]"
                  >
                    <option value="pdf">PDF Document (.pdf)</option>
                    <option value="png">PNG Image (.png)</option>
                    <option value="jpg">JPEG / JPG Image (.jpg, .jpeg)</option>
                    <option value="webp">WebP Image (.webp)</option>
                    <option value="docx">Microsoft Word (.docx)</option>
                    <option value="doc">Microsoft Word 97-2003 (.doc)</option>
                    <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
                    <option value="csv">CSV Spreadsheet (.csv)</option>
                    <option value="txt">Plain Text (.txt)</option>
                  </select>
                </div>
              </div>
            )}
          </Card>

          {/* STEP 2: CHOOSE TARGET FORMAT & CONVERSION OPTIONS */}
          {selectedFile && (
            <Card className="overflow-hidden border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fd-accent)] text-xs font-bold text-white">
                  2
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--fd-text-primary)]">
                    Choose Target Format & Adjust Settings
                  </h3>
                  <p className="text-xs text-[var(--fd-text-secondary)]">
                    Select what format you want to convert {SUPPORTED_FORMAT_METAS[activeInputFormat]?.label} into.
                  </p>
                </div>
              </div>

              {/* Target Format Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableTargets.map((target) => {
                  const isSelected = activeTargetFormat === target.id;
                  return (
                    <div
                      key={target.id}
                      role="button"
                      data-testid={`target-format-${target.id}`}
                      tabIndex={0}
                      onClick={() => setSelectedTargetFormat(target.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedTargetFormat(target.id)}
                      className={cn(
                        'flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer',
                        isSelected
                          ? 'border-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)] ring-2 ring-[var(--fd-accent)]/20 shadow-xs'
                          : 'border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] hover:border-[var(--fd-border-strong)] hover:bg-[var(--fd-surface-3)]',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[var(--fd-text-primary)]">
                          {target.label}
                        </span>
                        {isSelected ? (
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--fd-accent)] text-white">
                            <Check size={10} />
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono uppercase text-[var(--fd-text-tertiary)]">
                            .{target.extension}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--fd-text-secondary)] leading-snug line-clamp-2">
                        {target.description}
                      </p>
                      {target.recommendedFor && (
                        <div className="mt-2 text-[10px] text-[var(--fd-status-done)] font-medium">
                          ✦ {target.recommendedFor}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CONTEXTUAL MODIFICATION CONTROLS */}
              {isImageActive && (
                <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--fd-border-subtle)] pb-2 text-xs font-semibold text-[var(--fd-text-primary)]">
                    <Sliders size={14} className="text-[var(--fd-accent)]" />
                    <span>Image Modification & Quality Adjustments</span>
                  </div>

                  {/* JPG / WEBP Compression Quality Slider */}
                  {(activeTargetFormat === 'jpg' || activeTargetFormat === 'jpeg' || activeTargetFormat === 'webp') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--fd-text-primary)]">
                          Compression Quality: {Math.round(imageOptions.quality * 100)}%
                        </span>
                        <span className="text-[10px] text-[var(--fd-text-tertiary)]">
                          {imageOptions.quality < 0.7 ? 'Small size (gov portals <200KB)' : 'High clarity'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={imageOptions.quality}
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            quality: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full accent-[var(--fd-accent)] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Background Fill for Transparency (vital for PNG -> JPG) */}
                  {(activeInputFormat === 'png' && (activeTargetFormat === 'jpg' || activeTargetFormat === 'jpeg')) && (
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-[var(--fd-text-primary)]">
                        Transparency Background Fill:
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={imageOptions.backgroundColor === 'white' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => setImageOptions((prev) => ({ ...prev, backgroundColor: 'white' }))}
                          className="h-7 text-xs"
                        >
                          White Background (Standard)
                        </Button>
                        <Button
                          type="button"
                          variant={imageOptions.backgroundColor === 'black' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => setImageOptions((prev) => ({ ...prev, backgroundColor: 'black' }))}
                          className="h-7 text-xs"
                        >
                          Black Background
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Resize Controls */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-[var(--fd-text-primary)]">
                      Dimension & Resize:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[50, 75, 100, 150].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            setImageOptions((prev) => ({
                              ...prev,
                              resizeMode: pct === 100 ? 'none' : 'percent',
                              resizePercent: pct as 25 | 50 | 75 | 100 | 125 | 150 | 200,
                            }))
                          }
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            (imageOptions.resizeMode === 'percent' && imageOptions.resizePercent === pct) ||
                              (imageOptions.resizeMode === 'none' && pct === 100)
                              ? 'bg-[var(--fd-accent)] text-white'
                              : 'border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                          )}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rotation & Flip Controls */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setImageOptions((prev) => ({
                          ...prev,
                          rotate: ((prev.rotate + 90) % 360) as 0 | 90 | 180 | 270,
                        }))
                      }
                      className="h-8 gap-1.5"
                    >
                      <RotateCw size={13} />
                      <span>Rotate 90° ({imageOptions.rotate}°)</span>
                    </Button>

                    <Button
                      type="button"
                      variant={imageOptions.flipHorizontal ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        setImageOptions((prev) => ({
                          ...prev,
                          flipHorizontal: !prev.flipHorizontal,
                        }))
                      }
                      className="h-8"
                    >
                      Flip H
                    </Button>

                    <Button
                      type="button"
                      variant={imageOptions.filter === 'grayscale' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        setImageOptions((prev) => ({
                          ...prev,
                          filter: prev.filter === 'grayscale' ? 'none' : 'grayscale',
                        }))
                      }
                      className="h-8"
                    >
                      Grayscale B&W
                    </Button>

                    <Button
                      type="button"
                      variant={imageOptions.filter === 'contrast' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        setImageOptions((prev) => ({
                          ...prev,
                          filter: prev.filter === 'contrast' ? 'none' : 'contrast',
                        }))
                      }
                      className="h-8"
                    >
                      Document Clean Contrast
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Step 3 (Convert Execution, Preview & Output) */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-5 shadow-sm space-y-5 sticky top-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fd-accent)] text-xs font-bold text-white">
                3
              </span>
              <h3 className="text-base font-semibold text-[var(--fd-text-primary)]">
                Execute & Download
              </h3>
            </div>

            {/* Execution Action Button */}
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleConvert}
                disabled={!selectedFile || !activeTargetFormat || isConverting}
                className="w-full justify-center gap-2 py-6 text-sm font-semibold shadow-md"
              >
                {isConverting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Converting File...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={16} />
                    <span>
                      Convert to{' '}
                      {activeTargetFormat ? activeTargetFormat.toUpperCase() : 'Format'}
                    </span>
                  </>
                )}
              </Button>

              {isConverting && (
                <div className="space-y-1.5 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-3">
                  <div className="flex items-center justify-between text-xs text-[var(--fd-text-secondary)]">
                    <span>{conversionStatusText}</span>
                    <span className="font-semibold">{conversionProgress}%</span>
                  </div>
                  <ProgressBar value={conversionProgress} label="Conversion progress" />
                </div>
              )}
            </div>

            {/* CONVERSION RESULT CARD */}
            {conversionResult && (
              <div className="rounded-xl border border-[var(--fd-status-done)]/30 bg-[var(--fd-status-done)]/10 p-4 space-y-4">
                <div className="flex items-center gap-2 text-[var(--fd-status-done)]">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Ready For Download
                  </span>
                </div>

                <div className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fd-text-secondary)]">File Name:</span>
                    <span className="font-mono font-medium text-[var(--fd-text-primary)] truncate max-w-[200px]">
                      {conversionResult.outputFileName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fd-text-secondary)]">Output Size:</span>
                    <span className="font-medium text-[var(--fd-text-primary)]">
                      {conversionResult.outputSizeFormatted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fd-text-secondary)]">Target Format:</span>
                    <Badge tone="accent" className="text-[10px] uppercase font-mono">
                      {conversionResult.targetFormat}
                    </Badge>
                  </div>
                </div>

                {/* Output Preview */}
                {conversionResult.previewUrl && (
                  <div className="overflow-hidden rounded-lg border border-[var(--fd-border-subtle)] bg-zinc-900/10 dark:bg-black/30 p-2 text-center">
                    <img
                      src={conversionResult.previewUrl}
                      alt="Converted Output Preview"
                      className="max-h-48 mx-auto object-contain rounded"
                    />
                  </div>
                )}

                {conversionResult.previewText && (
                  <div className="overflow-hidden rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-2.5 text-left font-mono text-[11px] text-[var(--fd-text-secondary)] max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {conversionResult.previewText}...
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleDownload}
                    className="w-full gap-2 justify-center"
                  >
                    <Download size={15} />
                    <span>Download {conversionResult.targetFormat.toUpperCase()} File</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setSaveVaultDialogOpen(true)}
                    className="w-full gap-2 justify-center"
                  >
                    <FolderCheck size={15} />
                    <span>Save to Client Documents Vault</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Feature Information Note */}
            <div className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-3 text-[11px] text-[var(--fd-text-secondary)] space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--fd-text-primary)]">
                <HelpCircle size={13} className="text-[var(--fd-accent)]" />
                <span>Confidential Practice Processing</span>
              </div>
              <p>
                Files are converted client-side using browser memory and Web Standards. Documents do not leave your workstation unless you choose to save them to a client vault.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Save To Vault Dialog */}
      <SaveToVaultDialog
        open={saveVaultDialogOpen}
        onOpenChange={setSaveVaultDialogOpen}
        conversionResult={conversionResult}
      />
    </div>
  );
}
