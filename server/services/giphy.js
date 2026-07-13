const giphyApiBase = 'https://api.giphy.com/v1/gifs'
const defaultLimit = 24
const maxLimit = 50

const pickGifUrl = (gif) => {
  const images = gif?.images ?? {}

  return (
    images.downsized?.url ||
    images.fixed_height?.url ||
    images.original?.url ||
    null
  )
}

export const mapGiphyResults = (payload) =>
  (payload?.data ?? [])
    .map((gif) => {
      const url = pickGifUrl(gif)

      if (!url) {
        return null
      }

      return {
        id: String(gif.id ?? ''),
        title: String(gif.title ?? 'GIF'),
        url,
        preview_url: gif.images?.fixed_height_small?.url || url,
        width: Number(gif.images?.fixed_height?.width ?? 0) || null,
        height: Number(gif.images?.fixed_height?.height ?? 0) || null,
      }
    })
    .filter(Boolean)

export const searchGiphy = async ({ query, offset = 0, limit = defaultLimit, apiKey }) => {
  const trimmedKey = String(apiKey ?? '').trim()

  if (!trimmedKey) {
    const error = new Error('GIPHY is not configured on this server.')
    error.statusCode = 503
    throw error
  }

  const safeLimit = Math.min(Math.max(Number(limit) || defaultLimit, 1), maxLimit)
  const safeOffset = Math.max(Number(offset) || 0, 0)
  const trimmedQuery = String(query ?? '').trim()
  const endpoint = trimmedQuery ? 'search' : 'trending'
  const params = new URLSearchParams({
    api_key: trimmedKey,
    limit: String(safeLimit),
    offset: String(safeOffset),
    rating: 'pg-13',
  })

  if (trimmedQuery) {
    params.set('q', trimmedQuery)
  }

  const response = await fetch(`${giphyApiBase}/${endpoint}?${params.toString()}`)

  if (!response.ok) {
    const error = new Error('GIF search is temporarily unavailable.')
    error.statusCode = 502
    throw error
  }

  const payload = await response.json()

  return {
    gifs: mapGiphyResults(payload),
    pagination: {
      offset: safeOffset,
      count: payload?.pagination?.count ?? 0,
      total_count: payload?.pagination?.total_count ?? 0,
    },
  }
}
