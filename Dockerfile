# Dockerfile for BetterShift Production

# Stage 1: Dependencies
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy only package files for better caching
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm-deps \
    npm ci --cache /root/.npm-deps

# Stage 2: Builder
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Build argument for version
ARG VERSION=dev

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application with cache mount
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# drizzle-orm is the only runtime dependency outside the standalone trace; the
# migrator needs it as a real module. Pruned here, not in the runner: deleting
# in a later stage only writes whiteouts over layers already built and pushed.
RUN find /app/node_modules/drizzle-orm \
        \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.cts' \) -delete

# Stage 3: Runner
FROM node:24-alpine AS runner
# su-exec: see docker-entrypoint.sh.
RUN apk add --no-cache libc6-compat dumb-init su-exec
WORKDIR /app

# Build-time metadata (passed from GitHub Actions)
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG COMMIT_SHA=unknown
ARG COMMIT_REF=unknown
# ARG is not visible to a RUN command's process env; without these the build
# metadata below is written as empty strings.
ENV VERSION=$VERSION
ENV BUILD_DATE=$BUILD_DATE
ENV COMMIT_SHA=$COMMIT_SHA
ENV COMMIT_REF=$COMMIT_REF

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Docker sets HOSTNAME to the container id and the standalone server binds to
# it, leaving 127.0.0.1 unbound so the HEALTHCHECK can never pass. A runtime
# -e still overrides this.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/lib/db/db-path.mjs ./lib/db/db-path.mjs
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Must stay after the COPY of ./public, which would otherwise restore a
# root-owned uploads directory. Lets `docker run --user node` work unrepaired.
RUN mkdir -p /app/data /app/public/uploads \
    && chown -R node:node /app/data /app/public/uploads

# Write build metadata
RUN node -e "const fs=require('fs');fs.writeFileSync('/app/.build-info.json',JSON.stringify({version:process.env.VERSION||'',buildDate:process.env.BUILD_DATE||'',commitSha:process.env.COMMIT_SHA||'',commitRef:process.env.COMMIT_REF||''}));"

# Expose port
EXPOSE 3000

# Health check using dedicated health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode===200?0:1))}).on('error',()=>process.exit(1))"

# dumb-init stays PID 1 for signal handling; see docker-entrypoint.sh for why
# this is not a plain `USER node`.
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]

# Start with migration, then server
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
