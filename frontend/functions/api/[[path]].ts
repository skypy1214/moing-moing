type ApiProxyContext = {
  env: {
    API_ORIGIN?: string
  }
  request: Request
}

export const onRequest = async ({
  env,
  request,
}: ApiProxyContext): Promise<Response> => {
  const configuredOrigin = env.API_ORIGIN?.trim()
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

  // This server-to-server request does not need browser CORS handling. Keep Cookie so
  // the Render session remains available while the browser treats it as first-party.
  headers.delete('host')
  headers.delete('origin')

  return fetch(upstreamUrl, {
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    headers,
    method: request.method,
    redirect: 'manual',
  })
}
