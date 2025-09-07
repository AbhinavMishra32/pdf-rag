"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';

export interface SourceItem {
  doc: number;
  page: number | null;
  snippet: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: SourceItem[];
  isLoading?: boolean;
  isError?: boolean;
}

interface ChatPanelProps {
  disabled?: boolean; 
  currentDocumentName?: string | null;
  onSelectSource?: (s: SourceItem) => void;
}

export default function ChatPanel({ disabled, currentDocumentName, onSelectSource }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { user } = useUser();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendQuestion = useCallback(async () => {
    const q = questionInput.trim();
    if (!q || isSending || disabled) return;
    setIsSending(true);

      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: q };
      const pendingAssistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: 'Thinking...', isLoading: true };
      const historyPayload = messages.map(m => ({ role: m.role, text: m.text })).slice(-12); // last 12 messages max
      setMessages(prev => [...prev, userMessage, pendingAssistant]);
      setQuestionInput('');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, userId: user?.id, history: historyPayload })
        });
        if (!res.ok || !res.body) {
          let errJson: any = {}; try { errJson = await res.json(); } catch {}
          throw new Error(errJson?.message || 'Request failed');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accText = '';
        let currentSources: SourceItem[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let lines = buffer.split('\n');
            buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.type === 'meta') {
                if (Array.isArray(evt.sources)) currentSources = evt.sources;
                setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? { ...m, sources: currentSources } : m));
              } else if (evt.type === 'chunk') {
                accText += evt.delta;
                setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? { ...m, text: accText, sources: currentSources } : m));
              } else if (evt.type === 'done') {
                setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? { ...m, isLoading: false } : m));
              } else if (evt.type === 'error') {
                throw new Error(evt.error || 'Stream error');
              }
            } catch (e) {
              // ignore malformed line
            }
          }
        }
        // finalize if still loading
        setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? { ...m, isLoading: false } : m));
      } catch (err: any) {
          setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? {
              ...m,
              text: err?.message || 'Error getting answer',
              isLoading: false,
              isError: true
          } : m));
      } finally {
          setIsSending(false);
      }
  }, [questionInput, isSending, disabled]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  // Turn citations like [Doc 1 p8, Doc 2 p4] into inline clickable tags
  function renderAssistantText(text: string, sources?: SourceItem[]) {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    const regex = /\[(Doc[^\]]+)\]/g; // capture bracket groups containing Doc references
    let lastIndex = 0; let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) parts.push(<span key={parts.length}>{before}</span>);
      const inside = match[1];
      const tokens = inside.split(/[;,]/).map(t => t.trim()).filter(Boolean);
      parts.push(
        <span key={parts.length} className="inline-flex flex-wrap gap-1 align-middle ml-1 mr-1">
          {tokens.map(tok => {
            const m = /Doc\s+(\d+)(?:\s*p(\d+))?/i.exec(tok);
            if (!m) return <span key={tok} className="text-[10px] opacity-60">[{tok}]</span>;
            const docNum = Number(m[1]);
            const pageNum = m[2] ? Number(m[2]) : undefined;
            let source = sources?.find(s => s.doc === docNum);
            if (!source) {
              source = { doc: docNum, page: pageNum ?? null, snippet: '' };
            } else if (pageNum && source.page !== pageNum) {
              // create a shallow clone with adjusted page if model cited a specific page variant
              source = { ...source, page: pageNum };
            }
            const label = `Doc ${docNum}${pageNum ? ` p${pageNum}` : source.page ? ` p${source.page}` : ''}`;
            return (
              <button
                key={tok+parts.length}
                type="button"
                onClick={() => onSelectSource?.(source!)}
                className="text-[10px] px-2 py-0.5 rounded border bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
              >{label}</button>
            );
          })}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    const tail = text.slice(lastIndex);
    if (tail) parts.push(<span key={parts.length}>{tail}</span>);
    return parts;
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Ask Questions</h2>
          <p className="text-[11px] text-[var(--foreground)]/55">{currentDocumentName ? `Selected: ${currentDocumentName}` : 'No document selected'}</p>
        </div>
      </div>
  <div ref={listRef} className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
        {messages.length === 0 && (
          <div className="text-[12px] text-[var(--foreground)]/50 leading-relaxed max-w-md">
            Ask about the content of your uploaded documents. If the answer is not in them the model will say it does not know.
          </div>
        )}
        {messages.map(msg => {
          const isUser = msg.role === 'user'
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-md border p-3 text-sm shadow-sm ${isUser ? 'bg-indigo-600 text-white border-indigo-600/70' : 'bg-[var(--surface)]/40 border-[var(--border-color)]'}`}
              >
                <div className={`text-[10px] uppercase tracking-wide font-medium mb-1 ${isUser ? 'text-white/70' : 'text-[var(--foreground)]/50'}`}>{isUser ? 'You' : 'Assistant'}</div>
                <p className={`whitespace-pre-wrap leading-relaxed ${msg.isError ? (isUser ? 'text-red-200 dark:text-red-300' : 'text-red-600 dark:text-red-400') : ''}`}>
                  {isUser ? msg.text : renderAssistantText(msg.text, msg.sources)}
                </p>
                {msg.isLoading && (<div className={`mt-2 text-[10px] ${isUser ? 'text-white/70' : 'text-[var(--foreground)]/40'}`}>Loading…</div>)}
              </div>
            </div>
          )
        })}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); sendQuestion(); }} className="mt-auto pt-2 border-t border-[var(--border-color)] flex flex-col gap-2">
        <textarea
          value={questionInput}
          onChange={e => setQuestionInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Waiting for a document to finish indexing...' : 'Ask a question about your documents'}
          className="w-full h-24 resize-none rounded-md border border-[var(--border-color)] bg-[var(--surface)]/50 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
          disabled={disabled || isSending}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] text-[var(--foreground)]/45">Press Enter to send • Shift+Enter for newline</div>
          <button
            type="submit"
            disabled={disabled || isSending || !questionInput.trim()}
            className="h-9 px-4 rounded-md text-sm font-medium bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
          >{isSending ? 'Sending…' : 'Ask'}</button>
        </div>
      </form>
    </div>
  );
}
