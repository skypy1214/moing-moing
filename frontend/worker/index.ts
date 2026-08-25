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
  const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID()
  const startedAt = Date.now()

  // The browser talks to this Worker as its own origin. The upstream only needs
  // the session Cookie; an Origin header would incorrectly trigger CORS handling.
  headers.delete('host')
  headers.delete('origin')
  headers.set('X-Request-Id', requestId)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      headers,
      method: request.method,
      redirect: 'manual',
    })
    const responseHeaders = new Headers(upstreamResponse.headers)
    responseHeaders.set('X-Request-Id', requestId)
    console.info('api-proxy', {
      requestId,
      method: request.method,
      path: requestUrl.pathname,
      status: upstreamResponse.status,
      durationMs: Date.now() - startedAt,
    })
    return new Response(upstreamResponse.body, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    })
  } catch (error) {
    console.error('api-proxy-failed', {
      requestId,
      method: request.method,
      path: requestUrl.pathname,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return new Response('API upstream is unavailable.', {
      headers: { 'X-Request-Id': requestId },
      status: 502,
    })
  }
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
