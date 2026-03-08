const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchWithAuth(path: string, options: RequestInit = {}, token: string) {
  // 1. Prepare the flexible headers object
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  };

  // 2. Only add JSON content-type if we aren't sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  // 3. USE the 'headers' variable we just created!
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers, // <--- Fix: Use the variable, don't re-hardcode here
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Projects
  getProjects: (token: string) => fetchWithAuth('/api/projects', {}, token),
  getProject: (id: string, token: string) => fetchWithAuth(`/api/projects/${id}`, {}, token),
  createProject: (data: any, token: string) =>
    fetchWithAuth('/api/projects', { method: 'POST', body: JSON.stringify(data) }, token),
  updateProject: (id: string, data: any, token: string) =>
    fetchWithAuth(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),
  deleteProject: (id: string, token: string) =>
    fetchWithAuth(`/api/projects/${id}`, { method: 'DELETE' }, token),

  // Deployments
  getDeployments: (params: { projectId?: string; limit?: number }, token: string) => {
    const qs = new URLSearchParams();
    if (params.projectId) qs.set('projectId', params.projectId);
    if (params.limit) qs.set('limit', String(params.limit));
    return fetchWithAuth(`/api/deployments?${qs}`, {}, token);
  },
  getDeployment: (id: string, token: string) => fetchWithAuth(`/api/deployments/${id}`, {}, token),
  deployFromGitHub: (data: any, token: string) =>
    fetchWithAuth('/api/deployments/github', { method: 'POST', body: JSON.stringify(data) }, token),
  deployFromZip: (formData: FormData, token: string) =>
    fetch(`${API_URL}/api/deployments/zip`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error);
      }
      return res.json();
    }),
  cancelDeployment: (id: string, token: string) =>
    fetchWithAuth(`/api/deployments/${id}`, { method: 'DELETE' }, token),
};
