"use client";
// PDF Viewer wrapper that accepts: string URL | Uint8Array | File
import { useEffect, useState } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

export type PdfInput = string | Uint8Array | File;

interface PdfViewProps { file: PdfInput }

export default function PdfView({ file }: PdfViewProps) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const [resolved, setResolved] = useState<string | Uint8Array | null>(
    file instanceof File ? null : file
  );

  useEffect(() => {
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setResolved(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setResolved(file);
    }
  }, [file]);

  if (!resolved) {
    return <div className="w-full h-[90vh] flex items-center justify-center text-xs text-[var(--foreground)]/60 border rounded-lg border-[var(--border-color)]">Loading PDF...</div>;
  }

  return (
    <div className="w-full h-[90vh] overflow-hidden bg-white dark:bg-neutral-900 rounded-lg border border-[var(--border-color)]">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={resolved} enableSmoothScroll={true} plugins={[defaultLayoutPluginInstance]} />
      </Worker>
    </div>
  );
}