import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('index.html uses the Swinlearn logo as the favicon', () => {
  assert.match(indexHtml, /<link rel="icon" type="image\/png" href="\/logoSwinlearn\.png" \/>/)
})
