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

  if (body && !isFormData) {
    headers.set('Content-Type', 'application/json')
    requestInit.body = JSON.stringify(body)
  } else {
    requestInit.body = body as BodyInit | null | undefined
  }

  const response = await fetch(path, requestInit)
  const text = await response.text()
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
