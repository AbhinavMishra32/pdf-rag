"use client"
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const current = theme === 'system' ? systemTheme : theme

  if (!mounted) {
    return (
      <button aria-label="Toggle theme" className="h-10 w-10 rounded-full border border-black/10 dark:border-white/15 flex items-center justify-center text-sm opacity-50" disabled>
        <Sun className="h-5 w-5" />
      </button>
    )
  }

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="h-10 w-10 rounded-full border border-black/10 dark:border-white/15 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
    >
      {current === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}