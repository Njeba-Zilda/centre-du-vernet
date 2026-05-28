export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type ApiError = {
  error?: string
  message?: string
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

export async function apiPost<T>(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw data as ApiError
  return data as T
}

export async function apiGet<T>(path: string, token?: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw data as ApiError
  return data as T
}

