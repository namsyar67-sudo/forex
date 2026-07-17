# AI Trading Terminal — Dockerfile
# Multi-stage build for production.

# ── Stage 1: Dependencies ──────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY mini-services/market-stream/package.json ./mini-services/market-stream/
RUN bun install --frozen-lockfile
RUN cd mini-services/market-stream && bun install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mini-services/market-stream/node_modules ./mini-services/market-stream/node_modules
COPY . .
RUN bun run db:generate
RUN bun run build

# ── Stage 3: Runtime ───────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/terminal.db"

# Install socket.io client deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/db ./db

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000 3003 3004

# Start both the market-stream service and the Next.js app
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
