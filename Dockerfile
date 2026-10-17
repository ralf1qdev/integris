# syntax=docker/dockerfile:1.7
# One build, three runtime targets: web, bot, worker.
#   docker build --target web    -t integris-web .
#   docker build --target bot    -t integris-bot .
#   docker build --target worker -t integris-worker .
#   docker build --target community -t integris-community .

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
COPY apps/worker/package.json apps/worker/
COPY apps/community/package.json apps/community/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/security/package.json packages/security/
COPY packages/database/prisma packages/database/prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @integris/database generate \
 && pnpm --filter @integris/bot --filter @integris/worker --filter @integris/community build \
 && pnpm --filter @integris/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node

FROM runtime AS web
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3000"]

FROM runtime AS bot
WORKDIR /app/apps/bot
CMD ["node", "dist/index.js"]

FROM runtime AS worker
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]

FROM runtime AS community
WORKDIR /app/apps/community
CMD ["node", "dist/index.js"]

# Applies database migrations, then exits. Run before starting a new release.
FROM runtime AS migrate
WORKDIR /app/packages/database
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
