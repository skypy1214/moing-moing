const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const apiLoadingChangeEvent = 'moingmoing:api-loading-change'
export const apiUnauthorizedEvent = 'moingmoing:api-unauthorized'

let pendingApiRequestCount = 0

export const apiBaseUrl = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/$/, '')
  : ''

export function isApiLoading() {
  return pendingApiRequestCount > 0
}

function notifyApiLoadingChange() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(apiLoadingChangeEvent, {
      detail: isApiLoading(),
    }),
  )
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input !== 'string' || !input.startsWith('/api/')) {
    return globalThis.fetch(input, init)
  }

  pendingApiRequestCount += 1
  notifyApiLoadingChange()

  return globalThis
    .fetch(`${apiBaseUrl}${input}`, init)
    .then((response) => {
      if (
        response.status === 401 &&
        !input.includes('/api/v1/auth/login') &&
        typeof window !== 'undefined'
      ) {
        window.dispatchEvent(new Event(apiUnauthorizedEvent))
      }
      return response
    })
    .finally(() => {
      pendingApiRequestCount -= 1
      notifyApiLoadingChange()
    })
}
