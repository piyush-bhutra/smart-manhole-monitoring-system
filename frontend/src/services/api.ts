import type {
  Alert,
  AlertStatus,
  IngestResult,
  MonitorNode,
  Range,
  Reading,
  Scenario,
  Summary,
} from '../types/api'

const base = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(body?.error?.message || `API request failed (${response.status}).`)
  if (body === null) throw new Error('The API returned an invalid JSON response.')
  return body as T
}

export const api = {
  summary: (signal?: AbortSignal) => request<Summary>('/summary', { signal }),
  nodes: (signal?: AbortSignal) => request<MonitorNode[]>('/nodes', { signal }),
  alerts: (signal?: AbortSignal) => request<Alert[]>('/alerts', { signal }),
  node: (id: string, signal?: AbortSignal) =>
    request<MonitorNode>(`/nodes/${encodeURIComponent(id)}`, { signal }),
  history: (id: string, range: Range, signal?: AbortSignal) =>
    request<Reading[]>(`/nodes/${encodeURIComponent(id)}/readings?range=${range}`, { signal }),
  scenario: (id: string, scenario: Scenario) =>
    request<IngestResult>('/simulator/scenario', {
      method: 'POST',
      body: JSON.stringify({ node_id: id, scenario }),
    }),
  updateAlert: (id: number, status: Exclude<AlertStatus, 'active'>) =>
    request<Alert>(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

export async function refreshDemo() {
  const result = await request<{ refreshed_nodes: number }>('/demo/baseline', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'restore_demo_measurements' }),
  })
  return result.refreshed_nodes
}
