# Run the full stack with: npm run dev  (or scripts/start-stack.cmd)
# Do not run this image alone — api, mysql, qdrant, and ollama are in docker-compose.yml.
FROM node:22-bookworm

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
COPY prisma ./prisma

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN npx prisma generate

COPY . .

EXPOSE 3001 5173

CMD ["npm", "run", "dev:native:web", "--", "--host", "0.0.0.0"]
