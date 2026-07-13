import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertCommunityBody,
  assertCommunityCommentContent,
  assertCommunityGifUrl,
  assertCommunityPostContent,
  canDeleteCommunityComment,
  canDeleteCommunityPost,
  canModerateCommunity,
} from './community.js'

const student = (id) => ({ id, role: 'student' })
const teacher = (id) => ({ id, role: 'teacher' })
const admin = (id) => ({ id, role: 'admin' })

const offering = (staffIds = []) => ({
  staff: staffIds.map((userId) => ({ userId })),
})

test('canModerateCommunity allows admin and offering staff', () => {
  assert.equal(canModerateCommunity(admin('a1'), offering()), true)
  assert.equal(canModerateCommunity(teacher('t1'), offering(['t1'])), true)
  assert.equal(canModerateCommunity(student('s1'), offering(['t1'])), false)
})

test('canDeleteCommunityPost allows author or moderator', () => {
  const post = { authorId: 's1' }

  assert.equal(canDeleteCommunityPost(student('s1'), offering(), post), true)
  assert.equal(canDeleteCommunityPost(teacher('t1'), offering(['t1']), post), true)
  assert.equal(canDeleteCommunityPost(student('s2'), offering(), post), false)
})

test('canDeleteCommunityComment allows author or moderator', () => {
  const comment = { authorId: 's1' }

  assert.equal(canDeleteCommunityComment(student('s1'), offering(), comment), true)
  assert.equal(canDeleteCommunityComment(teacher('t1'), offering(['t1']), comment), true)
  assert.equal(canDeleteCommunityComment(student('s2'), offering(), comment), false)
})

test('assertCommunityPostContent allows text, images, or both', () => {
  assert.equal(assertCommunityPostContent('  hello  ', 0), 'hello')
  assert.equal(assertCommunityPostContent('', 1), '')
  assert.equal(assertCommunityPostContent('  hi  ', 2), 'hi')
  assert.throws(() => assertCommunityPostContent('   ', 0), (error) => error.statusCode === 400)
})

test('assertCommunityGifUrl accepts Giphy and Tenor links', () => {
  assert.equal(
    assertCommunityGifUrl('https://media.giphy.com/media/abc123/giphy.gif'),
    'https://media.giphy.com/media/abc123/giphy.gif',
  )
  assert.equal(
    assertCommunityGifUrl('https://media.tenor.com/images/example.gif'),
    'https://media.tenor.com/images/example.gif',
  )
})

test('assertCommunityGifUrl rejects invalid gif links', () => {
  assert.throws(() => assertCommunityGifUrl('not-a-url'), (error) => error.statusCode === 400)
  assert.throws(
    () => assertCommunityGifUrl('http://example.com/x.gif'),
    (error) => error.statusCode === 400,
  )
})

test('assertCommunityCommentContent allows text, images, or gif', () => {
  assert.deepEqual(assertCommunityCommentContent({ body: 'hi', gifUrl: '', imageCount: 0 }), {
    body: 'hi',
    gifUrl: null,
  })
  assert.deepEqual(
    assertCommunityCommentContent({
      body: '',
      gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
      imageCount: 0,
    }),
    {
      body: '',
      gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
    },
  )
})
