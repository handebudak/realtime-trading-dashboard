'use client'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002'

type FetchOptions = RequestInit & { params?: Record<string, string | number | boolean | undefined> }

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  return url.toString()
}

async function request<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: FetchOptions = {}) {
  const { params, headers, body, ...rest } = options
  const url = buildUrl(path, params)
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body,
    ...rest,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed: ${res.status}`
    throw new Error(message)
  }
  return data as T
}

export const api = {
  get: <T = any>(path: string, options?: FetchOptions) => request<T>('GET', path, options),
  post: <T = any>(path: string, body?: any, options?: Omit<FetchOptions, 'body'>) =>
    request<T>('POST', path, { ...(options || {}), body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any, options?: Omit<FetchOptions, 'body'>) =>
    request<T>('PUT', path, { ...(options || {}), body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string, options?: FetchOptions) => request<T>('DELETE', path, options),
  baseUrl: BASE_URL,
}

export default api


