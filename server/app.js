import express from 'express'

import { attachUser } from './auth-middleware.js'
import { prisma } from './db.js'
import { asyncHandler, resolveHttpError, sendError } from './http.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { workspaceRouter } from './routes/workspace.js'

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(attachUser)

  app.get(
    '/api/health',
    asyncHandler(async (_request, response) => {
      await prisma.$queryRaw`SELECT 1`
      response.json({ ok: true, database: true })
    }),
  )

  app.use('/api/auth', authRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/workspace', workspaceRouter)

  app.use((error, _request, response, _next) => {
    const { statusCode, message } = resolveHttpError(error)

    sendError(response, statusCode, message)
  })

  return app
}

export const app = createApp()
