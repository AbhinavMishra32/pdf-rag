
"use client"
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { File as FileIcon } from 'lucide-react'
import ChatPanel from '@/components/chat-panel'
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
const PdfViewer = dynamic(() => import('@/components/pdf-viewer').then(m => m.default), { ssr: false })

interface PdfViewerHandle { goToPage: (pageIndex: number) => void; highlightText: (text: string) => void }

export default function Home() {
  type DocumentStatus = 'uploading' | 'processing' | 'indexed' | 'failed'
  type DocumentEntry = { id: string; file: File; jobId?: string; status: DocumentStatus; docVectorId?: string }
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
  setDocuments(list => list.map(doc => doc.id === id ? { ...doc, jobId: json.jobId, status: 'processing', docVectorId: json.docId } : doc))
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

  const appUi = (
    <div className="h-[calc(100vh-4rem)] w-full flex overflow-hidden bg-[var(--background)]">
      <aside className="flex flex-col h-full w-[50%] max-w-[760px] border-r border-[var(--border-color)] bg-[var(--surface)]">
        <div className="flex-1 flex flex-col p-5 gap-5 overflow-hidden">
          <div className="flex-1 min-h-0 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-alt)] overflow-hidden flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
              {currentDocument ? (
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" title={currentDocument.file.name}>{currentDocument.file.name}</div>
                  <div className="text-[11px] text-gray-500">{currentDocument.status === 'indexed' ? 'Ready' : currentDocument.status === 'failed' ? 'Failed' : currentDocument.status === 'processing' ? 'Processing…' : 'Uploading…'} {currentDocument.jobId && '• '+currentDocument.jobId}</div>
                </div>
              ) : (
                <div className="text-sm font-medium text-gray-500">No document selected</div>
              )}
            </div>
            <div className="flex-1 overflow-hidden bg-[var(--surface)]">
              {currentDocument ? (
                <PdfViewer ref={pdfViewerRef as any} file={currentDocument.file} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">Upload a PDF below to start</div>
              )}
            </div>
          </div>

          <div className="h-40 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-alt)] flex flex-col shadow-sm">
            <div className="px-4 py-2 flex items-center gap-3 border-b border-[var(--border-color)]">
              <div className="text-sm font-medium flex-1 truncate">Docs ({documents.length})</div>
              <label
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`text-[11px] px-2 py-1 rounded-md cursor-pointer transition-colors border leading-none ${dragActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-[var(--surface)] border-[var(--border-color)] hover:border-blue-500 hover:text-blue-500'}`}
              >
                <input type="file" multiple accept="application/pdf" className="hidden" onChange={onFileInputChange} />
                Upload
              </label>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {documents.length === 0 && (
                <div className="text-[10px] text-gray-400 px-1 pt-1">No docs</div>
              )}
              {documents.map(d => (
                <button
                  key={d.id}
                  onClick={() => setCurrentDocumentId(d.id)}
                  className={`w-full text-left flex items-start gap-2 rounded-lg border px-2 py-1.5 transition-colors bg-[var(--surface)] ${d.id === currentDocumentId ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-[var(--border-color)] hover:border-blue-500'}`}
                >
                  <div className="h-6 w-6 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0"><FileIcon className="h-3 w-3 text-blue-500" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium" title={d.file.name}>{d.file.name}</p>
                    <p className={`text-[9px] ${d.status === 'indexed' ? 'text-green-600' : d.status === 'failed' ? 'text-red-600' : d.status === 'processing' ? 'text-amber-600' : 'text-gray-500'}`}>{d.status}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
  <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--background)]">
        <ChatPanel
          disabled={!currentDocument || currentDocument.status !== 'indexed'}
          currentDocumentName={currentDocument?.file.name || null}
          currentDocumentVectorId={currentDocument?.docVectorId || null}
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

  return (
    <>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/" signInFallbackRedirectUrl="/" />
      </SignedOut>
      <SignedIn>
        {appUi}
      </SignedIn>
    </>
  );
}
