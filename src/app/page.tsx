
"use client"
import FileUpload from "@/components/file-upload";
import { useState } from "react";

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const handleUpload = (files: File[]) => {
    const file = files[0]
    setUploadedFile(file)
    console.log('Uploaded file:', file)
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
      <main className="w-[70vw] min-h-full">
        <div className="h-full p-8">
          {!uploadedFile && (
            <div className="mt-10 text-sm text-[var(--foreground)]/60 max-w-md leading-relaxed">
              <h1 className="text-xl font-semibold mb-3 tracking-tight">Upload a document to begin</h1>
              Select or drag in a PDF on the left. After processing you'll be able to ask questions and run RAG queries here.
            </div>
          )}
          {uploadedFile && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Document Ready</h1>
                <p className="text-sm text-[var(--foreground)]/60 mt-1">{uploadedFile.name}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-color)] p-6 text-sm text-[var(--foreground)]/70 bg-[var(--surface)]/60 backdrop-blur-sm">
                Chat / analysis UI will appear here next.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
