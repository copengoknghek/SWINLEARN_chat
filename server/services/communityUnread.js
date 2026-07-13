const epoch = new Date(0)

async function countForOffering(prisma, userId, offeringId, since) {
  const [posts, comments] = await Promise.all([
    prisma.communityPost.count({
      where: {
        offeringId,
        authorId: { not: userId },
        createdAt: { gt: since },
      },
    }),
    prisma.communityComment.count({
      where: {
        post: { offeringId },
        authorId: { not: userId },
        createdAt: { gt: since },
      },
    }),
  ])

  return { posts, comments, total: posts + comments }
}

export async function countCommunityUnreadByOffering(prisma, userId, offeringIds) {
  if (offeringIds.length === 0) {
    return {}
  }

  const cursors = await prisma.communityReadCursor.findMany({
    where: {
      userId,
      offeringId: { in: offeringIds },
    },
  })
  const cursorByOffering = new Map(cursors.map((cursor) => [cursor.offeringId, cursor.lastReadAt]))

  const entries = await Promise.all(
    offeringIds.map(async (offeringId) => {
      const since = cursorByOffering.get(offeringId) ?? epoch
      const counts = await countForOffering(prisma, userId, offeringId, since)

      return [offeringId, counts]
    }),
  )

  return Object.fromEntries(entries)
}

export async function markCommunityRead(prisma, userId, offeringId) {
  const lastReadAt = new Date()

  await prisma.communityReadCursor.upsert({
    where: {
      userId_offeringId: { userId, offeringId },
    },
    create: { userId, offeringId, lastReadAt },
    update: { lastReadAt },
  })

  return lastReadAt
}
