FROM node:22-bookworm

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
COPY prisma ./prisma

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN npx prisma generate

COPY . .

EXPOSE 3001 5173

CMD ["npm", "run", "dev:web", "--", "--host", "0.0.0.0"]
