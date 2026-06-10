# Docker Development

Run the full app with one command:

```bash
docker compose up --build
```

Or, if you prefer the npm alias:

```bash
npm run docker:dev
```

This starts:

- Vite web app on `http://localhost:5173`
- Express API on `http://localhost:3001`
- MySQL inside Docker

The API waits for MySQL, applies the Prisma schema, and seeds demo data only when the Docker database has no users.

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

## Stop Containers

```bash
docker compose down
```

To delete the Docker database volume and start fresh:

```bash
docker compose down -v
```
