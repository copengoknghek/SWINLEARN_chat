export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | unknown | null
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, ...fetchOptions } = options
  const headers = new Headers(options.headers)
  const isFormData = body instanceof FormData
  const requestInit: RequestInit = {
    ...fetchOptions,
    credentials: 'include',
    headers,
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (body && !isFormData) {
    headers.set('Content-Type', 'application/json')
    requestInit.body = JSON.stringify(body)
  } else {
    requestInit.body = body as BodyInit | null | undefined
  }

  const response = await fetch(path, requestInit)
  const text = await response.text()
  const contentType = response.headers.get('Content-Type') ?? ''
  const hasJsonContent = contentType.toLowerCase().includes('application/json')

  if (text && !hasJsonContent) {
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error(
        'API returned HTML instead of JSON. Check that the API server is running and the request is being proxied correctly.',
      )
    }

    throw new Error(response.ok ? 'API returned a non-JSON response.' : text)
  }

  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Request failed'

    throw new Error(message)
  }

  return data as T
}
