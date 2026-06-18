import express from 'express'

import { prisma } from '../db.js'
import { asyncHandler, requireBodyString, sendError } from '../http.js'
import { mapUserProfile } from '../mappers.js'
import { hashPassword, verifyPassword } from '../services/passwords.js'
import {
  clearSessionCookie,
  createSession,
  deleteSessionForRequest,
  serializeSessionCookie,
} from '../services/session.js'
import { requireAuth } from '../auth-middleware.js'

export const authRouter = express.Router()

const authPayload = (user) => ({
  user: {
    id: user.id,
    email: user.email,
  },
  profile: mapUserProfile(user),
  role: user.role,
  mustChangePassword: user.mustChangePassword,
})

authRouter.get('/me', (request, response) => {
  response.json(request.currentUser ? authPayload(request.currentUser) : { user: null })
})

authRouter.post(
  '/login',
  asyncHandler(async (request, response) => {
    const email = requireBodyString(request.body, 'email').toLowerCase()
    const password = requireBodyString(request.body, 'password')
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!user || user.status !== 'active' || !verifyPassword(password, user.passwordHash)) {
      sendError(response, 401, 'Invalid email or password')
      return
    }

    const session = await createSession(user.id)

    response.setHeader('Set-Cookie', serializeSessionCookie(session.token, session.expiresAt))
    response.json(authPayload(user))
  }),
)

authRouter.post(
  '/logout',
  asyncHandler(async (request, response) => {
    await deleteSessionForRequest(request)
    response.setHeader('Set-Cookie', clearSessionCookie())
    response.json({ success: true })
  }),
)

authRouter.post(
  '/change-password',
  asyncHandler(async (request, response) => {
    const user = requireAuth(request, response)

    if (!user) {
      return
    }

    const password = requireBodyString(request.body, 'password')

    if (password.length < 8) {
      sendError(response, 400, 'Password must be at least 8 characters.')
      return
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: hashPassword(password),
        mustChangePassword: false,
        managedCredentials: {
          deleteMany: {},
        },
      },
    })

    response.json(authPayload(updatedUser))
  }),
)
