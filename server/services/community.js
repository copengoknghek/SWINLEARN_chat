export const canModerateCommunity = (user, offering) =>
  user.role === 'admin' || offering.staff.some((member) => member.userId === user.id)

export const canDeleteCommunityPost = (user, offering, post) =>
  post.authorId === user.id || canModerateCommunity(user, offering)

export const canDeleteCommunityComment = (user, offering, comment) =>
  comment.authorId === user.id || canModerateCommunity(user, offering)

export const assertCommunityPostContent = (body, imageCount = 0) => {
  const trimmed = String(body ?? '').trim()

  if (!trimmed && imageCount === 0) {
    const error = new Error('Add text or at least one image.')
    error.statusCode = 400
    throw error
  }

  return trimmed
}

/** @deprecated use assertCommunityPostContent */
export const assertCommunityBody = (body) => assertCommunityPostContent(body, 0)

const allowedGifHostSuffixes = ['giphy.com', 'tenor.com']

export const assertGifUrl = (value) => {
  const trimmed = String(value ?? '').trim()

  if (!trimmed) {
    return null
  }

  let url

  try {
    url = new URL(trimmed)
  } catch (_error) {
    const error = new Error('GIF link is not a valid URL.')
    error.statusCode = 400
    throw error
  }

  if (url.protocol !== 'https:') {
    const error = new Error('GIF links must use HTTPS.')
    error.statusCode = 400
    throw error
  }

  const host = url.hostname.toLowerCase()
  const isKnownHost = allowedGifHostSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  )
  const isDirectGif = /\.gif(?:$|[?#])/i.test(url.pathname + url.search)

  if (!isKnownHost && !isDirectGif) {
    const error = new Error('GIF links must come from Giphy, Tenor, or end in .gif.')
    error.statusCode = 400
    throw error
  }

  return trimmed
}

/** @deprecated use assertGifUrl */
export const assertCommunityGifUrl = assertGifUrl

export const assertCommunityCommentContent = ({ body, gifUrl, imageCount = 0 }) => {
  const trimmedBody = String(body ?? '').trim()
  const normalizedGifUrl = assertGifUrl(gifUrl)

  if (!trimmedBody && imageCount === 0 && !normalizedGifUrl) {
    const error = new Error('Add text, a file, or a GIF.')
    error.statusCode = 400
    throw error
  }

  return {
    body: trimmedBody,
    gifUrl: normalizedGifUrl,
  }
}

export const collectCommunityCommentSubtreeIds = async (prisma, rootId) => {
  const ids = [rootId]
  let queue = [rootId]

  while (queue.length > 0) {
    const children = await prisma.communityComment.findMany({
      where: { parentId: { in: queue } },
      select: { id: true },
    })

    queue = children.map((child) => child.id)
    ids.push(...queue)
  }

  return ids
}
