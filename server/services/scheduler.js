import cron from 'node-cron'

import { prisma } from '../db.js'
import { runWeeklyGold } from './gamification.js'

let started = false

export function startGamificationScheduler() {
  if (started || process.env.SWINLEARN_GAMIFICATION_CRON === 'false') {
    return
  }

  started = true

  cron.schedule(
    '0 0 * * 1',
    () => {
      void runWeeklyGold(prisma).catch((error) => {
        console.error('Weekly gamification job failed:', error)
      })
    },
    { timezone: 'UTC' },
  )
}
