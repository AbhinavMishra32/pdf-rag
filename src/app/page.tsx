
"use client"
import FileUpload from "@/components/file-upload";
import { useState } from "react";
import dynamic from 'next/dynamic'
const PdfViewer = dynamic(() => import('@/components/pdf-viewer'), { ssr: false })

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const handleUpload = async (files: File[]) => {
    const formData = new FormData();

    const file = files[0]
    setUploadedFile(file)
    formData.append('file', file)
    console.log('Uploaded file:', file)
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    console.log('Upload response:', res);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] w-screen flex">
      <aside className="w-[30vw] min-h-full p-4 xl:p-6 border-r border-[var(--border-color)] bg-[var(--surface-alt)]/50 dark:bg-[var(--surface-alt)]/40 backdrop-blur-sm flex flex-col">
        <FileUpload
          file={uploadedFile}
          onFileChange={setUploadedFile}
          onUpload={handleUpload}
        />
      </aside>
      
      <main className="w-[70vw] min-h-full flex flex-col">
        {!uploadedFile && (
          <div className="p-8 mt-10 text-sm text-[var(--foreground)]/60 max-w-md leading-relaxed">
            <h1 className="text-xl font-semibold mb-3 tracking-tight">Upload a document to begin</h1>
            Select or drag in a PDF on the left. After processing you'll be able to ask questions and run RAG queries here.
          </div>
        )}
        {uploadedFile && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-4 bg-[var(--surface)]/50 backdrop-blur-sm">
              <div>
                <h1 className="text-base font-semibold tracking-tight">{uploadedFile.name}</h1>
                <p className="text-[11px] text-[var(--foreground)]/55">PDF Preview & Highlight Scaffold</p>
              </div>
              {/* Placeholder highlight navigation */}
              <div className="flex items-center gap-2 text-xs">
                <button className="px-2 py-1 rounded border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40" disabled>
                  Prev Ref
                </button>
                <button className="px-2 py-1 rounded border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40" disabled>
                  Next Ref
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <PdfViewer file={uploadedFile} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
