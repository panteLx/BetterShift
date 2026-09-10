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

# Stage 3: Production dependencies
FROM node:24-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN --mount=type=cache,target=/root/.npm-prod \
    npm ci --omit=dev --cache /root/.npm-prod && \
    npm cache clean --force

# Stage 4: Runner
FROM node:24-alpine AS runner
# su-exec lets the entrypoint drop from root back to the unprivileged
# "node" user after fixing bind-mount ownership (see docker-entrypoint.sh).
RUN apk add --no-cache libc6-compat dumb-init su-exec
WORKDIR /app

# Build-time metadata (passed from GitHub Actions)
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG COMMIT_SHA=unknown
ARG COMMIT_REF=unknown
# Promote the build ARGs to ENV so the `node -e` RUN below can actually see
# them -- a plain ARG is not exposed to a RUN command's process env, so
# without this the build metadata below was always written as empty strings.
ENV VERSION=$VERSION
ENV BUILD_DATE=$BUILD_DATE
ENV COMMIT_SHA=$COMMIT_SHA
ENV COMMIT_REF=$COMMIT_REF

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The standalone server binds to $HOSTNAME, and Docker always sets HOSTNAME to
# the container id. Without this default it binds to that name only, so 127.0.0.1
# inside the container is unbound and the HEALTHCHECK below can never pass --
# the container is reported unhealthy even though it serves traffic fine.
# docker-compose.yml happens to supply HOSTNAME=0.0.0.0 through env_file, but a
# plain `docker run` does not. A runtime -e still overrides this.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy production dependencies. Required even though the standalone output
# already bundles its own node_modules: CMD runs `npm run db:migrate`,
# which needs drizzle-kit, and drizzle-kit is not part of the standalone
# trace. Do not remove this stage/copy -- doing so breaks migrations on
# every container start.
COPY --from=prod-deps /app/node_modules ./node_modules

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# The writable paths, handed to the unprivileged user at build time. This has
# to come after the COPY of ./public, which would otherwise put a root-owned
# uploads directory back. Giving them away here is what lets the image run
# under an explicit `docker run --user node` with no privileged repair step.
# A bind mount overrides all of it with the host's ownership: as root the
# entrypoint chowns that at startup, while an explicit non-root user needs the
# host directory to be writable for that uid -- nothing in the container can
# fix it from the inside.
RUN mkdir -p /app/data /app/public/uploads \
    && chown -R node:node /app/data /app/public/uploads

# Write build metadata
RUN node -e "const fs=require('fs');fs.writeFileSync('/app/.build-info.json',JSON.stringify({version:process.env.VERSION||'',buildDate:process.env.BUILD_DATE||'',commitSha:process.env.COMMIT_SHA||'',commitRef:process.env.COMMIT_REF||''}));"

# Expose port
EXPOSE 3000

# Health check using dedicated health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode===200?0:1))}).on('error',()=>process.exit(1))"

# dumb-init stays PID 1 for correct signal handling; it hands off to the
# entrypoint, which fixes bind-mount ownership as root and then drops
# privileges to the unprivileged "node" user before running CMD. A plain
# `USER node` is not safe here: existing deployments have a root-owned
# ./data bind mount from earlier root-run images, and the container would
# no longer be able to write its own database after upgrading.
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]

# Start with migration, then server
CMD ["sh", "-c", "npm run db:migrate && node server.js"]