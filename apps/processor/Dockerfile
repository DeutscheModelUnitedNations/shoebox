# Build context is the repository root:
#   docker build -f apps/processor/Dockerfile .
FROM oven/bun:1-slim AS deps
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/
COPY apps/processor/package.json apps/processor/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-slim AS release
WORKDIR /app

# ffmpeg for video poster frames. The upgrade picks up OS security fixes flagged by Trivy.
RUN apt-get update \
	&& apt-get upgrade -y --no-install-recommends \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists/*

ARG VERSION
ENV PUBLIC_VERSION=$VERSION
ARG SHA
ENV PUBLIC_SHA=$SHA

COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/apps ./apps
COPY --from=deps /build/packages ./packages
COPY package.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/processor ./apps/processor

RUN chown -R bun:bun .
USER bun
ENV NODE_ENV=production
EXPOSE 3001/tcp
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
	CMD bun -e "fetch('http://127.0.0.1:3001/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "run", "apps/processor/src/index.ts"]
