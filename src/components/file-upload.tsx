'use client'

import { Upload, File, X, Loader2 } from 'lucide-react'
import React from 'react'

type Props = {
    onUpload?: (files: File[]) => void
    file?: File | null
    onFileChange?: (file: File | null) => void
    multiple?: boolean
}

const bytes = (n: number) => {
    if (n < 1024) return n + ' B'
    const kb = n / 1024
    if (kb < 1024) return kb.toFixed(1) + ' KB'
    const mb = kb / 1024
    return mb.toFixed(2) + ' MB'
}

export default function FileUpload({ onUpload, file: externalFile, onFileChange, multiple }: Props) {
    const [internalFile, setInternalFile] = React.useState<File | null>(externalFile || null)
    const [dragActive, setDragActive] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    const [jobState, setJobState] = React.useState<'idle' | 'processing' | 'indexed' | 'failed'>('idle')
    const [jobId, setJobId] = React.useState<string | null>(null)
    const pollRef = React.useRef<NodeJS.Timeout | null>(null)
    const file = externalFile ?? internalFile

    const setFile = (f: File | null) => {
        if (!externalFile) setInternalFile(f)
        onFileChange?.(f)
    }

    const handleFiles = (files: FileList | null) => {
        if (!files || !files.length) return
        const list = Array.from(files)
        const pdf = list.find(f => f.type === 'application/pdf') || list[0]
        setFile(pdf)
    }

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files)
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        handleFiles(e.dataTransfer.files)
    }

    const onDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
        else if (e.type === 'dragleave') setDragActive(false)
    }

    const doUpload = async () => {
        if (!file) return
        setUploading(true)
        setJobState('idle')
        try {
            const form = new FormData()
            form.append('file', file)
            const res = await fetch('/api/upload', { method: 'POST', body: form })
            const json = await res.json()
            if (!res.ok || !json.jobId) throw new Error(json.error || 'Upload failed')
            setJobId(json.jobId)
            setJobState('processing')
            // Start polling every 2s for status
            startPoll(json.jobId)
        } catch (e) {
            console.error(e)
            setJobState('failed')
        } finally {
            setUploading(false)
        }
    }

    const startPoll = (id: string) => {
        clearPoll();
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/status?jobId=${id}`)
                if (!res.ok) return;
                const data = await res.json();
                if (data.state === 'completed') { setJobState('indexed'); clearPoll(); }
                else if (data.state === 'failed') { setJobState('failed'); clearPoll(); }
            } catch {}
        }, 2000);
    }

    const clearPoll = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }

    React.useEffect(() => () => clearPoll(), [])

    const reset = () => setFile(null)

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]/70 dark:bg-[var(--surface)]/60 backdrop-blur-sm p-5 flex flex-col">
                <h2 className="text-sm font-semibold tracking-wide text-[var(--foreground)]/80 mb-4">Document Upload</h2>
                {!file && (
                    <label
                        onDragEnter={onDrag}
                        onDragOver={onDrag}
                        onDragLeave={onDrag}
                        onDrop={onDrop}
                        className={`group relative flex flex-col grow items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer select-none px-4 text-center outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/70 ${dragActive ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-400/5' : 'border-black/15 dark:border-white/15 hover:border-indigo-400/60 dark:hover:border-indigo-400/60'}`}
                    >
                        <input type="file" className="hidden" onChange={onInputChange} accept="application/pdf,.pdf,.txt,.md" />
                        <div className="h-14 w-14 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-500/15 dark:group-hover:bg-indigo-400/20 transition-colors">
                            <Upload className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Drag & drop your document</p>
                            <p className="text-xs text-[var(--foreground)]/55">PDF, Markdown or Text. Max 20MB.</p>
                        </div>
                        <span className="inline-block rounded-md bg-indigo-600 text-white text-xs font-medium px-3 py-1 mt-2 group-hover:bg-indigo-500">
                            Browse Files
                        </span>
                    </label>
                )}
                                {file && (
                    <div className="flex flex-col grow">
                        <div className="flex items-start gap-3 rounded-md border border-black/10 dark:border-white/10 p-3 bg-[var(--surface-alt)]/60">
                            <div className="h-10 w-10 rounded-md bg-indigo-500/15 dark:bg-indigo-400/15 flex items-center justify-center">
                                <File className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                                                                <p className="text-xs text-[var(--foreground)]/60 flex items-center gap-1">
                                                                        {file.type || 'Unknown'} · {bytes(file.size)}
                                                                        {jobState !== 'idle' && (
                                                                            <span className={
                                                                                jobState === 'indexed' ? 'text-green-600 dark:text-green-400' : jobState === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                                                                            }>
                                                                                {jobState === 'processing' && 'Processing'}
                                                                                {jobState === 'indexed' && 'Indexed'}
                                                                                {jobState === 'failed' && 'Failed'}
                                                                            </span>
                                                                        )}
                                                                </p>
                            </div>
                            <button onClick={reset} aria-label="Remove file" className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-auto pt-6 flex flex-col gap-3">
                            <button
                                onClick={doUpload}
                                disabled={!file || uploading}
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium h-10 px-4 hover:bg-indigo-500 transition-colors"
                            >
                                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {uploading ? 'Uploading...' : jobState === 'processing' ? 'Processing...' : 'Upload'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFile(null)}
                                className="text-xs text-[var(--foreground)]/55 hover:text-[var(--foreground)]/80 self-start"
                            >Choose another file</button>
                        </div>
                    </div>
                )}
                <div className="mt-6 text-[10px] tracking-wide text-[var(--foreground)]/40">
                    Your file stays in-memory only for now (no backend upload yet).
                </div>
            </div>
        </div>
    )
}