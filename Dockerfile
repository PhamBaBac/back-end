# -------------------------------------------------------------
# Stage 1: Dependencies Cache
# -------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# -------------------------------------------------------------
# Stage 2: Application Builder
# -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate || true
RUN npm run build
RUN npm prune --production

# -------------------------------------------------------------
# Stage 3: Production Runner (Secure Unprivileged Non-Root)
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: run as unprivileged nodejs user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nestjs
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
