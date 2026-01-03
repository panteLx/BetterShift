# Dockerfile for BetterShift Production

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy only package files for better caching
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm-deps \
    npm ci --cache /root/.npm-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
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
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN --mount=type=cache,target=/root/.npm-prod \
    npm ci --omit=dev --cache /root/.npm-prod && \
    npm cache clean --force

# Stage 4: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

# Get VERSION from builder stage
ARG VERSION=dev

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create data directory
RUN mkdir -p /app/data

# Copy necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Write VERSION to file
RUN echo "$VERSION" > /app/.version

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {r.resume(); r.on('end', () => process.exit(r.statusCode === 200 ? 0 : 1))}).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start with migration, then server
CMD ["sh", "-c", "npm run db:migrate && node server.js"]