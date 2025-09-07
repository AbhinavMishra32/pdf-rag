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
          if (!res.ok) throw new Error('Request failed');
          
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No response stream');
          
          let assistantText = '';
          let sources: SourceItem[] = [];
          
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n').filter(line => line.trim());
              
              for (const line of lines) {
                  try {
                      const parsed = JSON.parse(line);
                      if (parsed.type === 'meta') {
                          sources = Array.isArray(parsed.sources) ? parsed.sources : [];
                      } else if (parsed.type === 'chunk' && parsed.delta) {
                          assistantText += parsed.delta;
                          setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? {
                              ...m, text: assistantText, sources, isLoading: true
                          } : m));
                      } else if (parsed.type === 'done') {
                          if (!assistantText.trim()) {
                              console.warn('[chat-panel] empty response from model');
                          }
                          setMessages(prev => prev.map(m => m.id === pendingAssistant.id ? {
                              ...m, text: assistantText, sources, isLoading: false
                          } : m));
                      } else if (parsed.type === 'error') {
                          throw new Error(parsed.error || 'Stream error');
                      }
                  } catch (parseErr) {
                      console.warn('[chat-panel] failed to parse stream line:', line);
                  }
              }
          }
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
                className="text-[10px] px-2 py-0.5 rounded border bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
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
    <div className="flex flex-col h-full bg-white">
      {/* Messages area */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-2xl font-medium text-gray-800 mb-2">Hello! How can I assist you today?</div>
            <div className="text-sm text-gray-500">Ask about the content of your uploaded documents.</div>
          </div>
        )}
        {messages.map(msg => {
          const isUser = msg.role === 'user'
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${isUser ? 'order-last' : ''}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    isUser 
                      ? 'bg-blue-500 text-white ml-auto' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className={`leading-relaxed ${msg.isError ? 'text-red-500' : ''} ${!isUser ? 'whitespace-pre-wrap' : ''}`}>
                    {isUser ? msg.text : renderAssistantText(msg.text, msg.sources)}
                  </div>
                  {msg.isLoading && (
                    <div className="mt-2 text-xs opacity-60">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Input area */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={(e) => { e.preventDefault(); sendQuestion(); }} className="relative">
          <div className="flex items-end bg-gray-100 rounded-2xl p-2">
            <textarea
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={disabled ? 'Waiting for a document to finish indexing...' : 'Send a message...'}
              className="flex-1 bg-transparent resize-none border-0 outline-none px-3 py-2 text-sm max-h-32 min-h-[40px]"
              disabled={disabled || isSending}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '40px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
            <button
              type="submit"
              disabled={disabled || isSending || !questionInput.trim()}
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="m12.815 12.197-7.532 1.256a.5.5 0 0 0-.386.318L2.3 20.728c-.248.64.421 1.25 1.035.942l18-9a.75.75 0 0 0 0-1.34l-18-9C2.721-.002 2.052.608 2.3 1.248l2.597 6.957a.5.5 0 0 0 .386.318l7.532 1.256a.2.2 0 0 1 0 .39Z"/>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
