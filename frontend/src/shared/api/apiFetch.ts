export const apiLoadingChangeEvent = 'moingmoing:api-loading-change'
export const apiUnauthorizedEvent = 'moingmoing:api-unauthorized'

let pendingApiRequestCount = 0

// Production requests are handled by the Cloudflare Worker /api proxy. Vite uses
// the same relative path through its local development proxy.
export const apiBaseUrl = ''

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
