import crypto from 'node:crypto'

import { prisma } from '../db.js'

export const sessionCookieName = 'swinlearn_session'

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export function parseCookies(request) {
  const header = request.headers.cookie ?? ''

  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=')

        if (separatorIndex === -1) {
          return [part, '']
        }

        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ]
      }),
  )
}

export function serializeSessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

  return [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ')
}

export function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sevenDaysMs)

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  })

  return {
    token,
    expiresAt,
  }
}

export async function deleteSessionForRequest(request) {
  const token = parseCookies(request)[sessionCookieName]

  if (!token) {
    return
  }

  await prisma.userSession.deleteMany({
    where: {
      tokenHash: hashToken(token),
    },
  })
}

export async function getSessionUser(request) {
  const token = parseCookies(request)[sessionCookieName]

  if (!token) {
    return null
  }

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: true,
    },
  })

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.userSession.delete({
        where: {
          id: session.id,
        },
      })
    }

    return null
  }

  return session.user.status === 'active' ? session.user : null
}
