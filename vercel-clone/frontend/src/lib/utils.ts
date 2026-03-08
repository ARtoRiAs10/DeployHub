import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatDuration(start: string | Date, end: string | Date | null) {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

export const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: 'Next.js',
  nuxt: 'Nuxt',
  vite: 'Vite',
  cra: 'Create React App',
  gatsby: 'Gatsby',
  sveltekit: 'SvelteKit',
  astro: 'Astro',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  static: 'Static HTML',
  docker: 'Custom Dockerfile',
}

export const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'text-yellow-400 bg-yellow-400/10',
  BUILDING: 'text-blue-400 bg-blue-400/10',
  SUCCESS: 'text-green-400 bg-green-400/10',
  FAILED: 'text-red-400 bg-red-400/10',
  CANCELLED: 'text-white/40 bg-white/5',
}
