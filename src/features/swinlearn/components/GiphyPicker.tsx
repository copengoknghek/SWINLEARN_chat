import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { getErrorMessage, searchCommunityGiphy } from '../lib/workspace/api'
import type { GiphyGifRow } from '../lib/workspace/types'

type GiphyPickerProps = {
  onClose: () => void
  onError?: (message: string) => void
  onSelect: (gifUrl: string) => void
  open: boolean
}

const searchDebounceMs = 300

export function GiphyPicker({ onClose, onError, onSelect, open }: GiphyPickerProps) {
  const searchInputId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GiphyGifRow[]>([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const loadGifs = useCallback(
    async (nextQuery: string, nextOffset: number, append: boolean) => {
      setLoading(true)

      try {
        const result = await searchCommunityGiphy(nextQuery, nextOffset)
        setGifs((current) => (append ? [...current, ...result.gifs] : result.gifs))
        setOffset(nextOffset + result.gifs.length)
        setHasMore(result.gifs.length > 0 && nextOffset + result.gifs.length < result.pagination.total_count)
      } catch (loadError) {
        const message = getErrorMessage(loadError, 'GIFs could not be loaded')
        onError?.(message)
      } finally {
        setLoading(false)
      }
    },
    [onError],
  )

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setQuery('')
      setGifs([])
      setOffset(0)
      setHasMore(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const timeoutId = window.setTimeout(
      () => {
        void loadGifs(query, 0, false)
      },
      query.trim() ? searchDebounceMs : 0,
    )

    return () => window.clearTimeout(timeoutId)
  }, [loadGifs, open, query])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="course-detail-community-giphy-picker" ref={panelRef}>
      <div className="course-detail-community-giphy-picker-header">
        <label className="sr-only" htmlFor={searchInputId}>
          Search GIFs
        </label>
        <input
          id={searchInputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search GIPHY"
          autoComplete="off"
        />
        <button type="button" className="course-detail-community-giphy-close" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && gifs.length === 0 ? (
        <p className="course-detail-community-giphy-status">Loading GIFs...</p>
      ) : gifs.length === 0 ? (
        <p className="course-detail-community-giphy-status">No GIFs found.</p>
      ) : (
        <div className="course-detail-community-giphy-grid" role="listbox" aria-label="GIF results">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className="course-detail-community-giphy-option"
              role="option"
              aria-label={gif.title}
              onClick={() => {
                onSelect(gif.url)
                onClose()
              }}
            >
              <img src={gif.preview_url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="course-detail-community-giphy-footer">
        {hasMore && (
          <button
            type="button"
            className="course-detail-community-giphy-more"
            disabled={loading}
            onClick={() => void loadGifs(query, offset, true)}
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
        <a
          className="course-detail-community-giphy-attribution"
          href="https://giphy.com/"
          rel="noreferrer"
          target="_blank"
        >
          Powered by GIPHY
        </a>
      </div>
    </div>
  )
}
