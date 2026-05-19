/**
 * api.ts — Frontend → Backend API client
 *
 * All requests include a Clerk Bearer token.
 * NEXT_PUBLIC_API_URL controls which backend is called (see .env.local).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// ── Core fetch helper ────────────────────────────────────────────────────────

async function fetchWithAuth(path: string, options: RequestInit = {}, token: string) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type'])
    headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Public endpoints (no auth token needed) ───────────────────────────────────

export type BackendStatus = {
  ok: boolean
  features: {
    aiDetection:  boolean
    ec2Deploys:   boolean
    s3Deploys:    boolean
    customDomain: boolean
  }
  region: string
}

export type HealthResponse = {
  status: 'ok'
  timestamp: string
  version: string
  env: string
}

/** Ping the backend health endpoint. Returns null if unreachable. */
export async function checkBackendHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** Get backend feature flags. Returns null if unreachable. */
export async function getBackendStatus(): Promise<BackendStatus | null> {
  try {
    const res = await fetch(`${API_URL}/api/status`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Authenticated API ─────────────────────────────────────────────────────────

export const api = {
  // ── Projects ───────────────────────────────────────────────────────────────
  getProjects:   (token: string) =>
    fetchWithAuth('/api/projects', {}, token),

  getProject:    (id: string, token: string) =>
    fetchWithAuth(`/api/projects/${id}`, {}, token),

  createProject: (data: any, token: string) =>
    fetchWithAuth('/api/projects', { method: 'POST', body: JSON.stringify(data) }, token),

  updateProject: (id: string, data: any, token: string) =>
    fetchWithAuth(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),

  deleteProject: (id: string, token: string) =>
    fetchWithAuth(`/api/projects/${id}`, { method: 'DELETE' }, token),

  // ── Environment Variables ──────────────────────────────────────────────────
  /**
   * Get env vars for a project.
   * @param reveal  Pass true to receive actual values (default: redacted as ***)
   */
  getProjectEnv: (id: string, token: string, reveal = false) =>
    fetchWithAuth(`/api/projects/${id}/env${reveal ? '?reveal=1' : ''}`, {}, token),

  /**
   * Replace all env vars for a project.
   * @param envVars  Plain key-value object { KEY: "value" }
   */
  setProjectEnv: (id: string, envVars: Record<string, string>, token: string) =>
    fetchWithAuth(`/api/projects/${id}/env`, {
      method: 'PUT',
      body: JSON.stringify({ envVars }),
    }, token),

  /**
   * Merge changes into existing env vars (add / update / delete individual keys).
   */
  patchProjectEnv: (id: string, changes: { set?: Record<string, string>; delete?: string[] }, token: string) =>
    fetchWithAuth(`/api/projects/${id}/env`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }, token),

  // ── Deployments ────────────────────────────────────────────────────────────
  getDeployments: (params: { projectId?: string; limit?: number }, token: string) => {
    const qs = new URLSearchParams()
    if (params.projectId) qs.set('projectId', params.projectId)
    if (params.limit)     qs.set('limit', String(params.limit))
    return fetchWithAuth(`/api/deployments?${qs}`, {}, token)
  },

  getDeployment: (id: string, token: string) =>
    fetchWithAuth(`/api/deployments/${id}`, {}, token),

  deployFromGitHub: (data: any, token: string) =>
    fetchWithAuth('/api/deployments/github', { method: 'POST', body: JSON.stringify(data) }, token),

  deployFromZip: (formData: FormData, token: string) =>
    fetchWithAuth('/api/deployments/zip', { method: 'POST', body: formData }, token),

  redeploy: (id: string, token: string) =>
    fetchWithAuth(`/api/deployments/${id}/redeploy`, { method: 'POST' }, token),

  // Alias used by the deployment detail page
  redeployFromDeployment: (id: string, token: string) =>
    fetchWithAuth(`/api/deployments/${id}/redeploy`, { method: 'POST' }, token),

  cancelDeployment: (id: string, token: string) =>
    fetchWithAuth(`/api/deployments/${id}`, { method: 'DELETE' }, token),
}