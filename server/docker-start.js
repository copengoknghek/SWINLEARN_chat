import { spawn } from 'node:child_process'
import process from 'node:process'

const databaseWaitAttempts = 30
const databaseWaitMs = 2000

const executable = (name) => (process.platform === 'win32' ? `${name}.cmd` : name)

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

async function createPrismaClient() {
  const { PrismaClient } = await import('@prisma/client')

  return new PrismaClient()
}

async function waitForDatabase() {
  let lastError

  for (let attempt = 1; attempt <= databaseWaitAttempts; attempt += 1) {
    const prisma = await createPrismaClient()

    try {
      await prisma.$queryRaw`SELECT 1`
      await prisma.$disconnect()
      console.log('Database is ready.')
      return
    } catch (error) {
      lastError = error
      await prisma.$disconnect().catch(() => undefined)
      console.log(`Waiting for database (${attempt}/${databaseWaitAttempts})...`)
      await wait(databaseWaitMs)
    }
  }

  throw lastError ?? new Error('Database did not become ready in time.')
}

async function seedIfEmpty() {
  const prisma = await createPrismaClient()

  try {
    const userCount = await prisma.user.count()

    if (userCount > 0) {
      console.log('Database already has users; skipping seed.')
      return
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('Database has no users; seeding demo data.')
  await run(executable('npm'), ['run', 'prisma:seed'])
}

async function main() {
  await run(executable('npx'), ['prisma', 'generate'])
  await waitForDatabase()
  await run(executable('npx'), ['prisma', 'db', 'push'])
  await seedIfEmpty()
  await import('./index.js')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
