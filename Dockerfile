# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @werewolf/server...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/engine packages/engine
COPY packages/server packages/server
RUN pnpm --filter @werewolf/shared build \
  && pnpm --filter @werewolf/engine build \
  && pnpm --filter @werewolf/server build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --prod --filter @werewolf/server...

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/engine/dist packages/engine/dist
COPY --from=build /app/packages/server/dist packages/server/dist

EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
