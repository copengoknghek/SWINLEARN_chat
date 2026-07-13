import 'dotenv/config'

import { app } from './app.js'
import { startGamificationScheduler } from './services/scheduler.js'

const port = Number(process.env.API_PORT ?? 3001)

startGamificationScheduler()

app.listen(port, () => {
  console.log(`SWINLEARN API listening on http://127.0.0.1:${port}`)
})
