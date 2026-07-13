import assert from 'node:assert/strict'
import test from 'node:test'

import { handleEnterToSubmit } from './composerEnterSubmit.mjs'

const createEvent = (overrides = {}) => ({
  key: 'Enter',
  shiftKey: false,
  preventDefault() {},
  nativeEvent: { isComposing: false },
  ...overrides,
})

test('handleEnterToSubmit calls onSubmit for plain Enter', () => {
  let prevented = false
  let submitted = false

  handleEnterToSubmit(
    {
      ...createEvent(),
      preventDefault() {
        prevented = true
      },
    },
    () => {
      submitted = true
    },
  )

  assert.equal(prevented, true)
  assert.equal(submitted, true)
})

test('handleEnterToSubmit ignores Shift+Enter', () => {
  let submitted = false

  handleEnterToSubmit(createEvent({ shiftKey: true }), () => {
    submitted = true
  })

  assert.equal(submitted, false)
})

test('handleEnterToSubmit respects canSubmit=false', () => {
  let submitted = false

  handleEnterToSubmit(
    createEvent(),
    () => {
      submitted = true
    },
    { canSubmit: false },
  )

  assert.equal(submitted, false)
})

