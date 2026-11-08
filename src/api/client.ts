import type { RawCatalog } from '../types'

// В dev запросы идут через прокси Vite на json-server (см. vite.config.ts).
// Для настоящего бэка достаточно поменять VITE_API_URL.
const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function loadCatalog(): Promise<RawCatalog> {
  const [objects, series, grates, parts, works, surfaces, classes, traps, floors, settings] = await Promise.all([
    request<RawCatalog['objects']>('/objects'),
    request<RawCatalog['series']>('/series'),
    request<RawCatalog['grates']>('/grates'),
    request<RawCatalog['parts']>('/parts'),
    request<RawCatalog['works']>('/works'),
    request<RawCatalog['surfaces']>('/surfaces'),
    request<RawCatalog['classes']>('/classes'),
    request<RawCatalog['traps']>('/traps'),
    request<RawCatalog['floors']>('/floors'),
    request<RawCatalog['settings']>('/settings'),
  ])
  return { objects, series, grates, parts, works, surfaces, classes, traps, floors, settings }
}

export interface LeadPayload {
  name: string
  phone: string
  email: string
  comment: string
  link: string
  summary: [string, string][]
  rows: { name: string; qty: string; unit: string; sum: number }[]
  total: number
  createdAt: string
}

export function sendLead(lead: LeadPayload): Promise<LeadPayload & { id: number }> {
  return request('/leads', { method: 'POST', body: JSON.stringify(lead) })
}
