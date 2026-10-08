# Build context is the repository root:
#   docker build -f apps/server/Dockerfile .
FROM oven/bun:1-slim AS base

# Full install for the build (devDependencies are bundled into the server by SvelteKit).
FROM base AS dependencies
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/
COPY apps/processor/package.json apps/processor/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# Production-only install: what `node build/index.js` and `drizzle-kit migrate` still need.
FROM base AS runtime-dependencies
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/
COPY apps/processor/package.json apps/processor/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production

FROM base AS builder
WORKDIR /build
ARG VERSION
ENV PUBLIC_VERSION=$VERSION
ARG SHA
ENV PUBLIC_SHA=$SHA
COPY --from=dependencies /build .
COPY . .
RUN cd apps/server && bun run prepare && bun run build

FROM node:lts-slim AS release
WORKDIR /app

# Patch OS packages in the base image to pick up security fixes flagged by Trivy.
RUN apt-get update \
	&& apt-get upgrade -y --no-install-recommends \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists/*

ARG VERSION
ENV PUBLIC_VERSION=$VERSION
ARG SHA
ENV PUBLIC_SHA=$SHA

COPY --from=builder /build/apps/server/build ./build
COPY --from=runtime-dependencies /build/node_modules ./node_modules
COPY --from=runtime-dependencies /build/apps ./apps
COPY --from=runtime-dependencies /build/packages ./packages
COPY package.json ./
# Migrations run from packages/db on start, drizzle-kit resolves paths relative to its cwd.
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db

RUN chown -R node:node .
USER node
ENV NODE_ENV=production
EXPOSE 3000/tcp
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "cd packages/db && node ../../node_modules/.bin/drizzle-kit migrate && cd ../.. && node build/index.js"]
