export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type ApiError = {
  error?: string
  message?: string
  status?: number
}

async function parseJsonSafe(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function handleUnauthorized() {
  localStorage.removeItem('vernet_access_token')
  window.location.href = '/login'
}

export async function apiPost<T>(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401 && token) { handleUnauthorized(); throw { error: 'SESSION_EXPIRED' } }
  const data = await parseJsonSafe(res)
  if (!res.ok) throw (typeof data === 'object' && data !== null ? data : { error: data ?? `HTTP_${res.status}` }) as ApiError
  return data as T
}

export async function apiPut<T>(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401 && token) { handleUnauthorized(); throw { error: 'SESSION_EXPIRED' } }
  const data = await parseJsonSafe(res)
  if (!res.ok) throw (typeof data === 'object' && data !== null ? data : { error: data ?? `HTTP_${res.status}` }) as ApiError
  return data as T
}

export async function apiGet<T>(path: string, token?: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401 && token) { handleUnauthorized(); throw { error: 'SESSION_EXPIRED' } }
  const data = await parseJsonSafe(res)
  if (!res.ok) throw (typeof data === 'object' && data !== null ? data : { error: data ?? `HTTP_${res.status}` }) as ApiError
  return data as T
}
