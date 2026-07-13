import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const databaseWaitAttempts = 30
const databaseWaitMs = 2000
const serviceWaitAttempts = 30
const serviceWaitMs = 2000

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

function countFromQueryRow(row) {
  const value = Object.values(row)[0]

  return Number(value)
}

export function shouldBaselineExistingDatabase({ hasPrismaMigrationsTable, userTableCount }) {
  return !hasPrismaMigrationsTable && userTableCount > 0
}

export function shouldSeedDemoData({ userCount, seedDemoData }) {
  return userCount === 0 && seedDemoData === 'true'
}

export function ollamaModelPresent(models, modelName) {
  return models.some(
    (model) => model.name === modelName || model.name.startsWith(`${modelName}:`),
  )
}

async function waitForHttpService({ label, url, attempts = serviceWaitAttempts, delayMs = serviceWaitMs }) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        console.log(`${label} is ready.`)
        return
      }

      lastError = new Error(`${label} returned status ${response.status}.`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    console.log(`Waiting for ${label} (${attempt}/${attempts})...`)
    await wait(delayMs)
  }

  throw lastError ?? new Error(`${label} did not become ready in time.`)
}

async function waitForQdrant() {
  const qdrantUrl = process.env.QDRANT_URL

  if (!qdrantUrl) {
    return
  }

  await waitForHttpService({ label: 'Qdrant', url: `${qdrantUrl}/healthz` })
}

async function ensureOllamaEmbedModel() {
  if ((process.env.SWINLEARN_EMBED_PROVIDER || 'ollama') !== 'ollama') {
    return
  }

  const ollamaUrl = process.env.OLLAMA_URL || 'http://ollama:11434'
  const model = process.env.SWINLEARN_EMBED_MODEL || 'nomic-embed-text'

  await waitForHttpService({ label: 'Ollama', url: `${ollamaUrl}/api/tags` })

  const tagsResponse = await fetch(`${ollamaUrl}/api/tags`)
  const { models = [] } = await tagsResponse.json()

  if (ollamaModelPresent(models, model)) {
    console.log(`Ollama model ${model} is ready.`)
    return
  }

  console.log(`Pulling Ollama model ${model}...`)
  const pullResponse = await fetch(`${ollamaUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: false }),
  })

  if (!pullResponse.ok) {
    throw new Error(`Failed to pull Ollama model ${model}.`)
  }

  console.log(`Ollama model ${model} is ready.`)
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
  let userCount

  try {
    userCount = await prisma.user.count()

    if (userCount > 0) {
      console.log('Database already has users; skipping seed.')
      return
    }
  } finally {
    await prisma.$disconnect()
  }

  if (!shouldSeedDemoData({ userCount, seedDemoData: process.env.SWINLEARN_SEED_DEMO_DATA })) {
    console.log('Database has no users; skipping demo seed. Set SWINLEARN_SEED_DEMO_DATA=true to load demo data.')
    return
  }

  console.log('Database has no users; seeding demo data.')
  await run(executable('npm'), ['run', 'prisma:seed'])
}

async function getMigrationNames() {
  const entries = await readdir(new URL('../prisma/migrations', import.meta.url), {
    withFileTypes: true,
  })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

async function getDatabaseMigrationState() {
  const prisma = await createPrismaClient()

  try {
    const [migrationTableRows, userTableRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = '_prisma_migrations'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name <> '_prisma_migrations'
      `,
    ])

    return {
      hasPrismaMigrationsTable: countFromQueryRow(migrationTableRows[0]) > 0,
      userTableCount: countFromQueryRow(userTableRows[0]),
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function baselineExistingDatabaseIfNeeded() {
  const state = await getDatabaseMigrationState()

  if (!shouldBaselineExistingDatabase(state)) {
    return
  }

  const migrationNames = await getMigrationNames()

  if (migrationNames.length === 0) {
    throw new Error('Database has tables but no Prisma migrations were found to baseline.')
  }

  console.log(
    `Database has ${state.userTableCount} existing tables but no Prisma migration history; baselining ${migrationNames.length} migration(s).`,
  )

  for (const migrationName of migrationNames) {
    await run(executable('npx'), ['prisma', 'migrate', 'resolve', '--applied', migrationName])
  }
}

async function recoverFailedMigrations() {
  const prisma = await createPrismaClient()

  try {
    const failedRows = await prisma.$queryRaw`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `

    for (const row of failedRows) {
      const migrationName = String(row.migration_name)
      console.log(`Recovering failed migration: ${migrationName}`)
      await run(executable('npx'), ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName])
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.includes('_prisma_migrations')) {
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

function startWatchedApiServer() {
  return new Promise((resolve, reject) => {
    const nodemonArgs = ['nodemon', '--watch', 'server', '--ext', 'js,mjs', 'server/index.js']

    if (process.env.SWINLEARN_API_LEGACY_WATCH === 'true') {
      nodemonArgs.splice(1, 0, '--legacy-watch')
    }

    const child = spawn(executable('npx'), nodemonArgs, {
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        process.exit(0)
        return
      }

      process.exit(code ?? 0)
    })
  })
}

async function main() {
  await run(executable('npx'), ['prisma', 'generate'])
  await waitForDatabase()
  await waitForQdrant()
  await ensureOllamaEmbedModel()
  await baselineExistingDatabaseIfNeeded()
  await recoverFailedMigrations()
  await run(executable('npx'), ['prisma', 'migrate', 'deploy'])
  await seedIfEmpty()
  console.log('API file watch enabled — server code changes reload without restarting Docker.')
  await startWatchedApiServer()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
