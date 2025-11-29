# Dockerfile for BetterShift Production

# Stage 1: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++ git
WORKDIR /app

# Copy package files and install ALL dependencies
# These layers are cached unless package files change
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate version information
RUN mkdir -p scripts public
COPY scripts/generate-version.sh scripts/
RUN chmod +x scripts/generate-version.sh && scripts/generate-version.sh

# Build the application
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Install only production dependencies (including drizzle-kit now)
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
