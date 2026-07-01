import assert from 'node:assert/strict'
import test from 'node:test'

import { mapGiphyResults, searchGiphy } from './giphy.js'

test('mapGiphyResults picks a usable GIF URL', () => {
  const gifs = mapGiphyResults({
    data: [
      {
        id: 'abc',
        title: 'Wave',
        images: {
          downsized: { url: 'https://media.giphy.com/media/abc/giphy.gif' },
          fixed_height_small: { url: 'https://media.giphy.com/media/abc/200.gif' },
          fixed_height: { width: '200', height: '200' },
        },
      },
      {
        id: 'missing',
        images: {},
      },
    ],
  })

  assert.equal(gifs.length, 1)
  assert.equal(gifs[0].url, 'https://media.giphy.com/media/abc/giphy.gif')
  assert.equal(gifs[0].preview_url, 'https://media.giphy.com/media/abc/200.gif')
})

test('searchGiphy requires an API key', async () => {
  await assert.rejects(
    () => searchGiphy({ query: 'hello', apiKey: '' }),
    (error) => error.statusCode === 503,
  )
})
