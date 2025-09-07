"use client";
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { searchPlugin, HighlightArea, Match } from '@react-pdf-viewer/search';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

export type PdfInput = string | Uint8Array | File;

interface PdfViewProps { file: PdfInput }
export interface PdfViewerHandle {
  goToPage: (pageIndex: number) => void;
  highlightText: (text: string) => void;
}

const PdfView = forwardRef<PdfViewerHandle, PdfViewProps>(({ file }, ref) => {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const pageNavPluginInstance = pageNavigationPlugin();
  const searchPluginInstance = searchPlugin();
  const { jumpToPage } = pageNavPluginInstance;
  const viewerRef = useRef<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastSnippet, setLastSnippet] = useState<string>('');
  const [highlightWord, setHighlightWord] = useState<string>('');
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

  useImperativeHandle(ref, () => ({
    goToPage: (pageIndex: number) => {
      try { jumpToPage(pageIndex) } catch {}
    },
    highlightText: async (text: string) => {
      if (!text) return;
      const cleaned = text.replace(/\s+/g, ' ').trim();
      const pick = cleaned.split(' ').find(w => w.length > 5) || cleaned.split(' ')[0];
      setSearchTerm(cleaned.slice(0, 80));
      setLastSnippet(cleaned);
      setHighlightWord((pick || '').toLowerCase());
      requestAnimationFrame(() => highlightVisible());
    }
  }), []);

  function highlightVisible() {
    if (!highlightWord) return;
    try {
      const container = document.querySelector('.rpv-core__inner-pages');
      if (!container) return;
      const spans = container.querySelectorAll('.rpv-core__text-layer span');
      spans.forEach(span => {
        const el = span as HTMLElement;
        const txt = el.textContent || '';
        if (txt.toLowerCase().includes(highlightWord)) {
          if (!el.dataset._hl) {
            el.dataset._hl = '1';
            el.classList.add('pdf-hl');
          }
        }
      });
    } catch {}
  }

  useEffect(() => {
    if (!highlightWord) return;
    const onScroll = () => requestAnimationFrame(highlightVisible);
    window.addEventListener('scroll', onScroll, true);
    highlightVisible();
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [highlightWord]);

  if (!resolved) {
    return <div className="w-full h-[90vh] flex items-center justify-center text-xs text-[var(--foreground)]/60 border rounded-lg border-[var(--border-color)]">Loading PDF...</div>;
  }

  return (
    <div className="w-full h-[90vh] overflow-hidden bg-white dark:bg-neutral-900 rounded-lg border border-[var(--border-color)] relative">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          ref={viewerRef}
          fileUrl={resolved}
          enableSmoothScroll={true}
          plugins={[defaultLayoutPluginInstance, pageNavPluginInstance, searchPluginInstance]}
        />
      </Worker>
      <style>{`.pdf-hl{background:rgba(250,219,20,0.55)!important;box-shadow:0 0 0 1px rgba(180,140,0,0.4);}`}</style>
      {searchTerm && (
        <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-black/60 text-white backdrop-blur-sm max-w-[40%] line-clamp-3">
          Highlight: <span className="font-medium">{highlightWord}</span>
        </div>
      )}
    </div>
  );
});

PdfView.displayName = 'PdfView';
export default PdfView;