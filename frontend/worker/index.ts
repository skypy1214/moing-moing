type StaticAssets = {
  fetch(request: Request): Promise<Response>
}

type Environment = {
  API_ORIGIN?: string
  ASSETS: StaticAssets
}

const apiPathPrefix = '/api/'

const proxyApiRequest = async (
  request: Request,
  environment: Environment,
): Promise<Response> => {
  const configuredOrigin = environment.API_ORIGIN?.trim()
  if (!configuredOrigin) {
    return new Response('API_ORIGIN is not configured.', { status: 500 })
  }

  let apiOrigin: URL
  try {
    apiOrigin = new URL(configuredOrigin)
  } catch {
    return new Response('API_ORIGIN must be a valid URL.', { status: 500 })
  }

  if (apiOrigin.protocol !== 'https:') {
    return new Response('API_ORIGIN must use HTTPS.', { status: 500 })
  }

  const requestUrl = new URL(request.url)
  const upstreamUrl = new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    apiOrigin.origin,
  )
  const headers = new Headers(request.headers)

  // The browser talks to this Worker as its own origin. The upstream only needs
  // the session Cookie; an Origin header would incorrectly trigger CORS handling.
  headers.delete('host')
  headers.delete('origin')

  return fetch(upstreamUrl, {
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    headers,
    method: request.method,
    redirect: 'manual',
  })
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const requestUrl = new URL(request.url)

    if (requestUrl.pathname.startsWith(apiPathPrefix)) {
      return proxyApiRequest(request, environment)
    }

    return environment.ASSETS.fetch(request)
  },
}
