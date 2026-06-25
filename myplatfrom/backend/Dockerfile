FROM oven/bun:1-alpine AS base
WORKDIR /app

# ── Install production deps only ──────────────────────────────────────────────
FROM base AS installer
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# ── Final image ───────────────────────────────────────────────────────────────
FROM base AS runner
COPY --from=installer /app/node_modules ./node_modules
COPY src ./src
COPY drizzle.config.ts package.json ./
# Drizzle migration files (generated via `bun run db:generate`)
COPY drizzle ./drizzle

EXPOSE 3010
# Run migrations then start server
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]
