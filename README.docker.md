# MySQL Development

The app uses React + Vite for the web UI, Express for the API, Prisma for schema
migrations, and MySQL 8 for local persistence.

## Docker MySQL

Run the full app with one command:

```bash
npm run dev
```

On Windows you can also double-click `scripts/start-stack.cmd`.

This is the canonical development command. It starts the Docker Compose stack,
so there is one normal local app runtime instead of separate npm and Docker
versions.

The command starts:

- Vite web app on `http://localhost:5173`
- Express API on `http://localhost:3001`
- MySQL inside Docker, unless `DOCKER_API_DATABASE_URL` points the API at a
  native MySQL database on your laptop
- Qdrant vector search on `http://localhost:6333`
- Ollama embeddings on `http://localhost:11434` (pulls `nomic-embed-text` on first run)

Follow logs with `npm run dev:logs`. Foreground mode (logs in the same terminal):
`npm run dev:attach`.

### Docker Desktop

Docker Desktop starts **one dependency tier per click** when services use
`depends_on`. That caused click 1 = mysql/qdrant/ollama, click 2 = api, click 3 =
web.

`api` and `web` no longer use `depends_on`. They start in the same wave; the API
waits for MySQL/Qdrant/Ollama inside `server/docker-start.js`.

To start everything:

1. Click **Start** once on the **`swinlearn` project row**
2. `npm run dev`
3. `scripts/start-stack.cmd`

Stopped **ollama-model-init** is normal (one-shot model pull).

**agentmemory** is optional and uses a **separate** Compose project
(`docker-compose.agentmemory.yml`) so Docker Desktop does not try to start it
with the main app. Run `npm run agentmemory:up` when you need it.

## Fix "network ... not found" in Docker Desktop

Old containers can reference a deleted Docker network (often
`agentmemory-iii-init`). Repair the stack:

```bash
npm run dev:repair
```

Or double-click `scripts/repair-stack.cmd`.

Source files are bind-mounted into the `web` and `api` containers. Docker
Compose enables polling-based file watching:

- **Frontend** (`src/`): Vite hot-reloads in the browser.
- **Backend** (`server/`): nodemon restarts the API when `.js` / `.mjs` files
  change.

Normal source edits do not need `docker compose restart` or a full stack
rebuild. Recreate the stack once (`npm run dev:down` then `npm run dev`) only
after changing Docker, Vite, or dependency (`package.json`) configuration.

`prisma/schema.prisma` changes still need `docker compose restart api` (or a
one-off `npx prisma generate` inside the container) so the Prisma client
stays in sync.

`npm run docker:dev` is kept only as a compatibility alias for `npm run dev`.

Stop the full stack with:

```bash
npm run dev:down
```

The API waits for MySQL and runs `prisma migrate deploy`. It does not load demo
courses or demo users by default.

To intentionally load the demo seed into a disposable local database, set:

```text
SWINLEARN_SEED_DEMO_DATA=true
```

## MySQL Workbench

Workbench stays installed on your laptop. Connect it to the Docker MySQL server with:

```text
Host: localhost
Port: 3307
User: swinlearn
Password: password
Database: swinlearn
```

If port `3307` is already used, set `MYSQL_HOST_PORT` in `.env` and restart Compose.

## Native MySQL

If you prefer MySQL installed directly on your laptop, create the app database
with a MySQL root/admin account:

```sql
CREATE DATABASE IF NOT EXISTS swinlearn;
CREATE USER IF NOT EXISTS 'swinlearn'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON swinlearn.* TO 'swinlearn'@'%';
FLUSH PRIVILEGES;
```

Use this connection string in `.env`:

```text
DATABASE_URL="mysql://swinlearn:password@localhost:3306/swinlearn"
SESSION_SECRET="replace-with-a-long-random-development-secret"
API_PORT="3001"
```

The native commands are only an escape hatch when you intentionally do not want
Docker Compose. In two separate terminals, run:

```bash
npm run prisma:migrate:deploy
npm run dev:native:api
npm run dev:native:web
```

Run `npm run prisma:seed` only when you explicitly want the disposable demo
accounts and demo courses.

If a local database already contains the old demo records, remove them with:

```bash
npm run prisma:clear-demo
```

## Stop Containers

```bash
npm run dev:down
```

To delete the Docker database volume and start fresh:

```bash
docker compose down -v
```

## Agentmemory (optional)

Persistent memory for Cursor/Codex agents. Uses a **separate** Compose file
(`docker-compose.agentmemory.yml`) so it does not appear in the main `swinlearn`
stack in Docker Desktop.

Start the iii-engine only:

```bash
npm run agentmemory:up
```

Start engine + worker (keep terminal open for MCP):

```bash
scripts/start-agentmemory.cmd
```

Stop:

```bash
npm run agentmemory:down
```

Viewer: http://localhost:3113 (after worker is running)
