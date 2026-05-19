import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Shadcn/ui class name merger utility.
 * Combines conditional classes using clsx and intelligently overrides overlapping tailwind rules via twMerge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string or instance into a standard localized shorthand (e.g., "Oct 24, 04:15 PM").
 */
export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).format(new Date(date))
}

/**
 * Calculates and returns the user-friendly execution time between pipeline lifecycle hooks.
 */
export function formatDuration(start: string | Date, end: string | Date | null) {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s  = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ============================================================================
// DeployHub Constants & Dictionaries
// ============================================================================

export const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: 'Next.js', 
  nuxt: 'Nuxt', 
  vite: 'Vite', 
  cra: 'Create React App', 
  gatsby: 'Gatsby',
  'sveltekit-static': 'SvelteKit (Static)', 
  sveltekit: 'SvelteKit', 
  astro: 'Astro',
  'node-backend': 'Node.js (Server)', 
  node: 'Node.js', 
  fastapi: 'FastAPI', 
  flask: 'Flask',
  django: 'Django', 
  python: 'Python', 
  go: 'Go', 
  rust: 'Rust', 
  php: 'PHP',
  static: 'Static HTML', 
  docker: 'Custom Dockerfile',
}

export const FRAMEWORK_ICONS: Record<string, string> = {
  nextjs: '▲', 
  nuxt: '💚', 
  vite: '⚡', 
  cra: '⚛', 
  gatsby: '💜',
  'sveltekit-static': '🧡', 
  sveltekit: '🧡', 
  astro: '🚀',
  'node-backend': '🟩', 
  node: '🟩', 
  fastapi: '🐍', 
  flask: '🐍',
  django: '🐍', 
  python: '🐍', 
  go: '🐹', 
  rust: '🦀', 
  php: '🐘',
  static: '📄', 
  docker: '🐳',
}

export const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'text-yellow-400 bg-yellow-400/10', 
  BUILDING: 'text-blue-400 bg-blue-400/10',
  SUCCESS: 'text-green-400 bg-green-400/10', 
  FAILED: 'text-red-400 bg-red-400/10',
  CANCELLED: 'text-white/40 bg-white/5',
}

export const DETECTION_METHOD_COLORS: Record<string, string> = {
  config: 'text-purple-400 bg-purple-400/10', 
  curated: 'text-green-400 bg-green-400/10',
  static: 'text-blue-400 bg-blue-400/10', 
  llm: 'text-orange-400 bg-orange-400/10',
}

export const DETECTION_METHOD_LABELS: Record<string, string> = {
  config: 'deployhub.json', 
  curated: 'Auto (curated)', 
  static: 'Auto (pattern)', 
  llm: 'AI detected',
}

export const STATIC_FRAMEWORKS = new Set([
  'vite', 
  'cra', 
  'gatsby', 
  'astro', 
  'sveltekit-static', 
  'static'
])