export const GOLD_AMOUNTS = {
  like_received: 1,
  comment_received: 2,
  share_received: 3,
  weekly_badge: 5,
}

export const NEWBIE_GOLD_THRESHOLD = 10

export const CHAMPION_BADGE_TYPES = [
  'FAN_FAVORITE',
  'SUPER_SUPPORTER',
  'GOLD_KING',
  'TRENDING_CREATOR',
]

export const BADGE_LABELS = {
  FAN_FAVORITE: { emoji: '❤️', label: 'Fan Favorite' },
  SUPER_SUPPORTER: { emoji: '🤝', label: 'Super Supporter' },
  GOLD_KING: { emoji: '👑', label: 'Gold King' },
  TRENDING_CREATOR: { emoji: '🔥', label: 'Trending Creator' },
  NEWBIE: { emoji: '🌱', label: 'Newbie' },
}

export const goldForEvent = (type) => GOLD_AMOUNTS[type] ?? 0

export const isStudent = (user) => user?.role === 'student'

export function currentIsoWeekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc - yearStart) / 86_400_000 + 1) / 7)

  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function startOfIsoWeek(date = new Date()) {
  const start = new Date(date)
  const day = start.getUTCDay() || 7
  start.setUTCDate(start.getUTCDate() - day + 1)
  start.setUTCHours(0, 0, 0, 0)

  return start
}

export function endOfIsoWeek(date = new Date()) {
  const end = startOfIsoWeek(date)
  end.setUTCDate(end.getUTCDate() + 7)

  return end
}

export const selectChampion = (rows) => {
  if (!rows.length) {
    return null
  }

  const sorted = [...rows].sort((left, right) => {
    if (right.metric !== left.metric) {
      return right.metric - left.metric
    }

    const leftSince = left.since ? new Date(left.since).getTime() : Number.MAX_SAFE_INTEGER
    const rightSince = right.since ? new Date(right.since).getTime() : Number.MAX_SAFE_INTEGER

    return leftSince - rightSince
  })

  return sorted[0]?.metric > 0 ? sorted[0] : null
}

export function shouldShowNewbieBadge(user, championUserIds = new Set()) {
  if (!isStudent(user)) {
    return false
  }

  if (championUserIds.has(user.id)) {
    return false
  }

  return (user.goldBalance ?? 0) < NEWBIE_GOLD_THRESHOLD
}

export function badgesForUser(user, championBadgesByUserId, championUserIds) {
  if (!isStudent(user)) {
    return []
  }

  const badges = [...(championBadgesByUserId.get(user.id) ?? [])]

  if (shouldShowNewbieBadge(user, championUserIds)) {
    badges.push('NEWBIE')
  }

  return badges
}

async function loadStudent(tx, userId) {
  return tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, goldBalance: true },
  })
}

async function hasGoldTransaction(tx, { userId, reason, sourceType, sourceId, weekKey }) {
  return tx.goldTransaction.findFirst({
    where: {
      userId,
      reason,
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(weekKey ? { weekKey } : {}),
    },
    select: { id: true },
  })
}

export async function adjustGold(
  tx,
  {
    userId,
    amount,
    reason,
    sourceType = null,
    sourceId = null,
    weekKey = null,
    skipIfExists = false,
  },
) {
  if (!userId || amount === 0) {
    return false
  }

  const student = await loadStudent(tx, userId)

  if (!isStudent(student)) {
    return false
  }

  if (skipIfExists && sourceType && sourceId) {
    const existing = await hasGoldTransaction(tx, {
      userId,
      reason,
      sourceType,
      sourceId,
      weekKey: weekKey ?? undefined,
    })

    if (existing) {
      return false
    }
  }

  await tx.user.update({
    where: { id: userId },
    data: { goldBalance: { increment: amount } },
  })

  await tx.goldTransaction.create({
    data: {
      userId,
      amount,
      reason,
      sourceType,
      sourceId,
      weekKey,
    },
  })

  return true
}

export async function reverseGoldBySource(tx, { sourceType, sourceId }) {
  const originals = await tx.goldTransaction.findMany({
    where: { sourceType, sourceId, amount: { gt: 0 } },
  })

  let reversed = false

  for (const original of originals) {
    const existingReversal = await tx.goldTransaction.findFirst({
      where: {
        userId: original.userId,
        reason: 'reversal',
        sourceType,
        sourceId,
      },
    })

    if (existingReversal) {
      continue
    }

    await adjustGold(tx, {
      userId: original.userId,
      amount: -original.amount,
      reason: 'reversal',
      sourceType,
      sourceId,
    })
    reversed = true
  }

  return reversed
}

export async function awardPostLikeGold(tx, { postAuthorId, likerId, likeId }) {
  if (postAuthorId === likerId) {
    return false
  }

  return adjustGold(tx, {
    userId: postAuthorId,
    amount: goldForEvent('like_received'),
    reason: 'like_received',
    sourceType: 'post_like',
    sourceId: likeId,
    skipIfExists: true,
  })
}

export async function awardCommentLikeGold(tx, { commentAuthorId, likerId, likeId }) {
  if (commentAuthorId === likerId) {
    return false
  }

  return adjustGold(tx, {
    userId: commentAuthorId,
    amount: goldForEvent('like_received'),
    reason: 'like_received',
    sourceType: 'comment_like',
    sourceId: likeId,
    skipIfExists: true,
  })
}

export async function reversePostLikeGold(tx, { likeId }) {
  return reverseGoldBySource(tx, { sourceType: 'post_like', sourceId: likeId })
}

export async function reverseCommentLikeGold(tx, { likeId }) {
  return reverseGoldBySource(tx, { sourceType: 'comment_like', sourceId: likeId })
}

export async function awardCommentReceivedGold(tx, { recipientId, commenterId, commentId }) {
  if (recipientId === commenterId) {
    return false
  }

  return adjustGold(tx, {
    userId: recipientId,
    amount: goldForEvent('comment_received'),
    reason: 'comment_received',
    sourceType: 'comment',
    sourceId: commentId,
    skipIfExists: true,
  })
}

export async function reverseCommentReceivedGold(tx, { commentId }) {
  return reverseGoldBySource(tx, { sourceType: 'comment', sourceId: commentId })
}

export async function awardShareReceivedGold(tx, { postAuthorId, sharerId, shareEventId }) {
  if (postAuthorId === sharerId) {
    return false
  }

  return adjustGold(tx, {
    userId: postAuthorId,
    amount: goldForEvent('share_received'),
    reason: 'share_received',
    sourceType: 'share',
    sourceId: shareEventId,
    skipIfExists: true,
  })
}

export async function reverseCommentSubtreeGold(tx, commentId) {
  const subtreeIds = [commentId]
  let queue = [commentId]

  while (queue.length > 0) {
    const children = await tx.communityComment.findMany({
      where: { parentId: { in: queue } },
      select: { id: true },
    })

    queue = children.map((child) => child.id)
    subtreeIds.push(...queue)
  }

  const likes = await tx.communityCommentLike.findMany({
    where: { commentId: { in: subtreeIds } },
    select: { id: true },
  })

  for (const comment of subtreeIds) {
    await reverseCommentReceivedGold(tx, { commentId: comment })
  }

  for (const like of likes) {
    await reverseCommentLikeGold(tx, { likeId: like.id })
  }
}

export async function reversePostEngagementGold(tx, postId) {
  const postLikes = await tx.communityPostLike.findMany({
    where: { postId },
    select: { id: true },
  })

  const comments = await tx.communityComment.findMany({
    where: { postId },
    select: { id: true },
  })

  const commentIds = comments.map((comment) => comment.id)
  const commentLikes = commentIds.length
    ? await tx.communityCommentLike.findMany({
        where: { commentId: { in: commentIds } },
        select: { id: true },
      })
    : []

  const shares = await tx.shareEvent.findMany({
    where: { postId },
    select: { id: true },
  })

  for (const like of postLikes) {
    await reversePostLikeGold(tx, { likeId: like.id })
  }

  for (const comment of commentIds) {
    await reverseCommentReceivedGold(tx, { commentId: comment })
  }

  for (const like of commentLikes) {
    await reverseCommentLikeGold(tx, { likeId: like.id })
  }

  for (const share of shares) {
    await reverseGoldBySource(tx, { sourceType: 'share', sourceId: share.id })
  }
}

async function queryFanFavoriteChampion(tx) {
  const rows = await tx.communityPostLike.groupBy({
    by: ['postId'],
    _count: { _all: true },
    _min: { createdAt: true },
  })

  if (!rows.length) {
    return null
  }

  const posts = await tx.communityPost.findMany({
    where: { id: { in: rows.map((row) => row.postId) } },
    select: { id: true, authorId: true, author: { select: { role: true } } },
  })

  const postAuthorById = new Map(posts.map((post) => [post.id, post]))
  const totals = new Map()

  for (const row of rows) {
    const post = postAuthorById.get(row.postId)

    if (!post || !isStudent(post.author)) {
      continue
    }

    const current = totals.get(post.authorId) ?? { userId: post.authorId, metric: 0, since: null }

    current.metric += row._count._all
    const since = row._min.createdAt

    if (!current.since || (since && since < current.since)) {
      current.since = since
    }

    totals.set(post.authorId, current)
  }

  return selectChampion([...totals.values()])
}

async function querySuperSupporterChampion(tx) {
  const students = await tx.user.findMany({
    where: { role: 'student' },
    select: { id: true },
  })

  const studentIds = students.map((student) => student.id)

  if (!studentIds.length) {
    return null
  }

  const [postLikes, commentLikes, comments] = await Promise.all([
    tx.communityPostLike.groupBy({
      by: ['userId'],
      where: { userId: { in: studentIds } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    tx.communityCommentLike.groupBy({
      by: ['userId'],
      where: { userId: { in: studentIds } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    tx.communityComment.groupBy({
      by: ['authorId'],
      where: { authorId: { in: studentIds } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
  ])

  const totals = new Map()

  const addRows = (rows) => {
    for (const row of rows) {
      const userId = row.userId ?? row.authorId
      const current = totals.get(userId) ?? { userId, metric: 0, since: null }

      current.metric += row._count._all
      const since = row._min.createdAt

      if (!current.since || (since && since < current.since)) {
        current.since = since
      }

      totals.set(userId, current)
    }
  }

  addRows(postLikes)
  addRows(commentLikes)
  addRows(comments)

  return selectChampion([...totals.values()])
}

async function queryGoldKingChampion(tx) {
  const leader = await tx.user.findFirst({
    where: { role: 'student', goldBalance: { gt: 0 } },
    orderBy: [{ goldBalance: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, goldBalance: true, createdAt: true },
  })

  if (!leader) {
    return null
  }

  return {
    userId: leader.id,
    metric: leader.goldBalance,
    since: leader.createdAt,
  }
}

async function queryTrendingCreatorChampion(tx, weekStart, weekEnd, weekKey) {
  const posts = await tx.communityPost.findMany({
    select: { id: true, authorId: true, author: { select: { role: true } } },
  })

  if (!posts.length) {
    return null
  }

  const postIds = posts.map((post) => post.id)
  const [likes, comments] = await Promise.all([
    tx.communityPostLike.groupBy({
      by: ['postId'],
      where: {
        postId: { in: postIds },
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    tx.communityComment.groupBy({
      by: ['postId'],
      where: {
        postId: { in: postIds },
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
  ])

  const scores = new Map()

  const addRows = (rows) => {
    for (const row of rows) {
      const current = scores.get(row.postId) ?? { postId: row.postId, metric: 0, since: null }

      current.metric += row._count._all
      const since = row._min.createdAt

      if (!current.since || (since && since < current.since)) {
        current.since = since
      }

      scores.set(row.postId, current)
    }
  }

  addRows(likes)
  addRows(comments)

  const postById = new Map(posts.map((post) => [post.id, post]))
  const authorRows = []

  for (const score of scores.values()) {
    const post = postById.get(score.postId)

    if (!post || !isStudent(post.author)) {
      continue
    }

    authorRows.push({
      userId: post.authorId,
      metric: score.metric,
      since: score.since,
      weekKey,
    })
  }

  const champion = selectChampion(authorRows)

  if (!champion) {
    return null
  }

  return { ...champion, weekKey }
}

async function upsertChampionBadge(tx, type, champion) {
  const existing = await tx.studentBadge.findUnique({ where: { type } })

  if (!champion) {
    if (existing) {
      await tx.studentBadge.delete({ where: { type } })
    }

    return
  }

  if (existing?.userId === champion.userId) {
    if (type === 'TRENDING_CREATOR' && champion.weekKey && existing.weekKey !== champion.weekKey) {
      await tx.studentBadge.update({
        where: { type },
        data: { weekKey: champion.weekKey },
      })
    }

    return
  }

  await tx.studentBadge.upsert({
    where: { type },
    create: {
      type,
      userId: champion.userId,
      since: champion.since ? new Date(champion.since) : new Date(),
      weekKey: champion.weekKey ?? null,
    },
    update: {
      userId: champion.userId,
      since: champion.since ? new Date(champion.since) : new Date(),
      weekKey: champion.weekKey ?? null,
    },
  })
}

export async function recomputeBadges(prismaClient) {
  const weekStart = startOfIsoWeek()
  const weekEnd = endOfIsoWeek()
  const weekKey = currentIsoWeekKey()

  const [fanFavorite, superSupporter, goldKing, trendingCreator] = await Promise.all([
    queryFanFavoriteChampion(prismaClient),
    querySuperSupporterChampion(prismaClient),
    queryGoldKingChampion(prismaClient),
    queryTrendingCreatorChampion(prismaClient, weekStart, weekEnd, weekKey),
  ])

  await prismaClient.$transaction(async (tx) => {
    await upsertChampionBadge(tx, 'FAN_FAVORITE', fanFavorite)
    await upsertChampionBadge(tx, 'SUPER_SUPPORTER', superSupporter)
    await upsertChampionBadge(tx, 'GOLD_KING', goldKing)
    await upsertChampionBadge(tx, 'TRENDING_CREATOR', trendingCreator)
  })
}

export async function runWeeklyGold(prismaClient) {
  const weekKey = currentIsoWeekKey()
  const badges = await prismaClient.studentBadge.findMany({
    select: { userId: true, type: true },
  })

  await prismaClient.$transaction(async (tx) => {
    for (const badge of badges) {
      await adjustGold(tx, {
        userId: badge.userId,
        amount: goldForEvent('weekly_badge'),
        reason: 'weekly_badge',
        sourceType: 'badge',
        sourceId: badge.type,
        weekKey,
        skipIfExists: true,
      })
    }
  })

  await recomputeBadges(prismaClient)
}

export async function loadGamificationContext(prismaClient, userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))]

  if (!uniqueIds.length) {
    return {
      championBadgesByUserId: new Map(),
      championUserIds: new Set(),
      usersById: new Map(),
    }
  }

  const [users, badges] = await Promise.all([
    prismaClient.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, role: true, goldBalance: true },
    }),
    prismaClient.studentBadge.findMany({
      select: { userId: true, type: true },
    }),
  ])

  const championBadgesByUserId = new Map()
  const championUserIds = new Set()

  for (const badge of badges) {
    championUserIds.add(badge.userId)
    const current = championBadgesByUserId.get(badge.userId) ?? []
    current.push(badge.type)
    championBadgesByUserId.set(badge.userId, current)
  }

  return {
    championBadgesByUserId,
    championUserIds,
    usersById: new Map(users.map((user) => [user.id, user])),
  }
}

export function mapProfileGamification(user, context) {
  if (!user) {
    return { badges: [], gold_balance: 0 }
  }

  const profileUser = context?.usersById?.get(user.id) ?? user
  const badges = badgesForUser(
    {
      id: user.id,
      role: user.role ?? profileUser.role,
      goldBalance: profileUser.goldBalance ?? user.goldBalance ?? 0,
    },
    context?.championBadgesByUserId ?? new Map(),
    context?.championUserIds ?? new Set(),
  )

  return {
    badges,
    gold_balance: isStudent(user) ? (profileUser.goldBalance ?? user.goldBalance ?? 0) : 0,
  }
}
