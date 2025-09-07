
"use client"
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { File as FileIcon } from 'lucide-react'
import ChatPanel from '@/components/chat-panel'
import PdfView, { PdfViewerHandle } from '@/components/pdf-viewer'
import { useUser } from '@clerk/nextjs'
const PdfViewer = dynamic(() => import('@/components/pdf-viewer'), { ssr: false })

export default function Home() {
  type DocumentStatus = 'uploading' | 'processing' | 'indexed' | 'failed'
  type DocumentEntry = { id: string; file: File; jobId?: string; status: DocumentStatus }
  const { user } = useUser();

  const [documents, setDocuments] = useState<DocumentEntry[]>([])
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const pollIntervals = useRef<Record<string, any>>({})

  const currentDocument = documents.find(d => d.id === currentDocumentId) || null
  const pdfViewerRef = useRef<PdfViewerHandle | null>(null)

  function startStatusPolling(jobId: string, documentId: string) {
    if (pollIntervals.current[documentId]) clearInterval(pollIntervals.current[documentId])
    pollIntervals.current[documentId] = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/status?jobId=${jobId}`)
        if (!response.ok) return
        const json = await response.json()
        if (json.state === 'completed') {
          setDocuments(list => list.map(doc => doc.id === documentId ? { ...doc, status: 'indexed' } : doc))
          clearInterval(pollIntervals.current[documentId]); delete pollIntervals.current[documentId]
        } else if (json.state === 'failed') {
          setDocuments(list => list.map(doc => doc.id === documentId ? { ...doc, status: 'failed' } : doc))
          clearInterval(pollIntervals.current[documentId]); delete pollIntervals.current[documentId]
        }
      } catch {}
    }, 2000)
  }

  async function uploadDocument(file: File) {
    if (!user) {
      console.error('Cannot upload document: user not loaded.');
      return
    }
    const id = crypto.randomUUID()
    setDocuments(list => [{ id, file, status: 'uploading' }, ...list])
    if (!currentDocumentId) setCurrentDocumentId(id)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', user.id)
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await response.json()
      if (!response.ok || !json.jobId) throw new Error(json.error || 'upload failed')
      setDocuments(list => list.map(doc => doc.id === id ? { ...doc, jobId: json.jobId, status: 'processing' } : doc))
      startStatusPolling(json.jobId, id)
    } catch (err) {
      console.error(err)
      setDocuments(list => list.map(doc => doc.id === id ? { ...doc, status: 'failed' } : doc))
    }
  }

  function handleFileList(list: FileList | null) {
    if (!list) return
    Array.from(list).filter(f => f.type === 'application/pdf').forEach(uploadDocument)
  }

  const [dragActive, setDragActive] = useState(false)
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>): void { handleFileList(e.target.files); }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragActive(false); handleFileList(e.dataTransfer.files) }
  function handleDrag(e: React.DragEvent) { e.preventDefault(); if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true); else if (e.type === 'dragleave') setDragActive(false) }

  useEffect(() => () => { Object.values(pollIntervals.current).forEach(clearInterval) }, [])

  return (
    <div className="min-h-[calc(100vh-4rem)] w-screen flex">
      {/* Left column: viewer (top), documents list (middle), upload drop zone (bottom) */}
      <aside className="w-[55vw] min-h-full border-r border-[var(--border-color)] bg-[var(--surface-alt)]/40 backdrop-blur-sm flex flex-col overflow-hidden">
        {/* Viewer */}
        <div className="h-[55vh] border-b border-[var(--border-color)] p-3 flex flex-col">
          {currentDocument ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between pb-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate" title={currentDocument.file.name}>{currentDocument.file.name}</h2>
                  <p className="text-[10px] text-[var(--foreground)]/55">{currentDocument.status === 'indexed' ? 'Indexed' : currentDocument.status === 'failed' ? 'Failed' : currentDocument.status === 'processing' ? 'Processing…' : 'Uploading…'} {currentDocument.jobId && '• Job '+currentDocument.jobId}</p>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <PdfView ref={pdfViewerRef} file={currentDocument.file} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--foreground)]/50">Upload a PDF below to start.</div>
          )}
        </div>
        {/* Documents list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          {documents.length === 0 && (
            <div className="text-[var(--foreground)]/40 text-[11px]">No documents yet.</div>
          )}
          {documents.map(d => (
            <button
              key={d.id}
              onClick={() => setCurrentDocumentId(d.id)}
              className={`w-full text-left flex items-start gap-3 rounded-md border px-3 py-2 transition-colors ${d.id === currentDocumentId ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-black/10 dark:border-white/10 hover:border-indigo-400/50'}`}
            >
              <div className="h-8 w-8 rounded bg-indigo-500/15 flex items-center justify-center shrink-0"><FileIcon className="h-4 w-4 text-indigo-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium" title={d.file.name}>{d.file.name}</p>
                <p className={`text-[10px] ${d.status === 'indexed' ? 'text-green-600 dark:text-green-400' : d.status === 'failed' ? 'text-red-600 dark:text-red-400' : d.status === 'processing' ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--foreground)]/55'}`}>{d.status}</p>
              </div>
            </button>
          ))}
        </div>
        {/* Upload drop zone */}
        <div className="p-3 border-t border-[var(--border-color)]">
          <label
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`group relative flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-center p-4 cursor-pointer transition-colors text-[11px] ${dragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-black/15 dark:border-white/15 hover:border-indigo-400/60'}`}
          >
            <input type="file" multiple accept="application/pdf" className="hidden" onChange={onFileInputChange} />
            <span className="font-medium">Drop or Browse PDFs</span>
            <span className="text-[10px] text-[var(--foreground)]/50">Auto uploads • Multiple allowed</span>
          </label>
        </div>
      </aside>
      {/* Right side chat UI */}
      <main className="flex-1 min-h-full flex flex-col p-6">
        <ChatPanel
          disabled={!currentDocument || currentDocument.status !== 'indexed'}
          currentDocumentName={currentDocument?.file.name || null}
          onSelectSource={(s) => {
            if (s.page != null) {
              const pageIndex = Math.max(0, (s.page as number) - 1)
              pdfViewerRef.current?.goToPage(pageIndex)
            }
            if (s.snippet) {
              pdfViewerRef.current?.highlightText(s.snippet)
            }
          }}
        />
      </main>
    </div>
  );
}
