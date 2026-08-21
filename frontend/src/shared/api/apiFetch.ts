const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const apiBaseUrl = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/$/, '')
  : ''

export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input !== 'string' || !input.startsWith('/api/')) {
    return globalThis.fetch(input, init)
  }

  return globalThis.fetch(`${apiBaseUrl}${input}`, init)
}
