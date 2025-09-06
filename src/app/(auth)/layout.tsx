export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-900 dark:to-neutral-950">
      {children}
    </main>
  )
}
