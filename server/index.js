import 'dotenv/config'
import express from 'express'

import { attachUser } from './auth-middleware.js'
import { sendError } from './http.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { workspaceRouter } from './routes/workspace.js'

const app = express()
const port = Number(process.env.API_PORT ?? 3001)

app.use(express.json())
app.use(attachUser)

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/workspace', workspaceRouter)

app.use((error, _request, response, _next) => {
  const message = error instanceof Error ? error.message : 'Something went wrong'

  sendError(response, 500, message)
})

app.listen(port, () => {
  console.log(`SWINLEARN API listening on http://127.0.0.1:${port}`)
})
