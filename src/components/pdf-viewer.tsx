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
  const autoScrollDeadline = useRef<number>(0);

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
      const trimmed = text.length > 600 ? text.slice(0, 600) : text;
      const cleaned = trimmed.replace(/\s+/g, ' ').trim();
      const normalized = cleaned.toLowerCase();

  autoScrollDeadline.current = Date.now() + 2000;
  if (normalized === highlightWord) {
        setHighlightWord('');
        setTimeout(() => {
          setSearchTerm(cleaned.slice(0, 120));
          setLastSnippet(cleaned);
          setHighlightWord(normalized);
          scheduleHighlightRetries();
        }, 0);
      } else {
        setSearchTerm(cleaned.slice(0, 120));
        setLastSnippet(cleaned);
        setHighlightWord(normalized);
        scheduleHighlightRetries();
      }
    }
  }), [highlightWord, jumpToPage]);

  function highlightVisible() {
    if (!highlightWord) return;
    try {
      const container = document.querySelector('.rpv-core__inner-pages');
      if (!container) return;
      const spans = container.querySelectorAll('.rpv-core__text-layer span');

      spans.forEach(span => {
        const el = span as HTMLElement;
        if (el.dataset._hl) {
          el.classList.remove('pdf-hl');
          delete el.dataset._hl;
        }
      });

      const textNodes: { element: HTMLElement; text: string; startIndex: number }[] = [];
      let fullText = '';
      spans.forEach(span => {
        const el = span as HTMLElement;
        const text = el.textContent || '';
        if (text.trim()) {
          textNodes.push({ element: el, text, startIndex: fullText.length });
          fullText += text + ' ';
        }
      });

      const normalizedSnippet = highlightWord.toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizedFullText = fullText.toLowerCase();
      let matchIndex = normalizedFullText.indexOf(normalizedSnippet);
      let firstEl: HTMLElement | null = null;

      if (matchIndex !== -1) {
        const matchEnd = matchIndex + normalizedSnippet.length;
        textNodes.forEach(node => {
          const nodeStart = node.startIndex;
          const nodeEnd = nodeStart + node.text.length;
            if (nodeStart < matchEnd && nodeEnd > matchIndex) {
              node.element.dataset._hl = '1';
              node.element.classList.add('pdf-hl');
              if (!firstEl) firstEl = node.element;
            }
        });
      } else {
        const tokens = normalizedSnippet.split(' ').filter(t => t.length > 5);
        const distinct = Array.from(new Set(tokens)).slice(0, 3);
        if (distinct.length) {
          textNodes.forEach(node => {
            const lower = node.text.toLowerCase();
            if (distinct.some(tok => lower.includes(tok))) {
              node.element.dataset._hl = '1';
              node.element.classList.add('pdf-hl');
              if (!firstEl) firstEl = node.element;
            }
          });
        } else {
          scheduleHighlightRetries();
        }
      }

      if (firstEl && Date.now() < autoScrollDeadline.current) {
        (firstEl as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else if (matchIndex === -1) {
        scheduleHighlightRetries();
      }
    } catch {}
  }

  function scheduleHighlightRetries() {
    let attempts = 0;
    const maxAttempts = 5;
    const run = () => {
      attempts++;
      highlightVisible();
      if (attempts < maxAttempts) {
        setTimeout(run, 120 * attempts); 
      }
    };
    requestAnimationFrame(run);
  }

  useEffect(() => {
    if (!highlightWord) return;
    const onScroll = () => {
      if (Date.now() > autoScrollDeadline.current) {
        // After deadline, stop forcing re-highlighting on scroll (normal scroll mode)
        window.removeEventListener('scroll', onScroll, true);
        return;
      }
      requestAnimationFrame(highlightVisible);
    };
    window.addEventListener('scroll', onScroll, true);
    highlightVisible();
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [highlightWord]);

  if (!resolved) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-[var(--foreground)]/60 border rounded-lg border-[var(--border-color)]">Loading PDF...</div>;
  }

  return (
  <div className="w-full h-full bg-[var(--surface)] rounded-lg border border-[var(--border-color)] relative">
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