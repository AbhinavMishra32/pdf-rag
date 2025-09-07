# Multi-stage Dockerfile for Cloud Run (Next.js + BullMQ worker)
# 1. Build stage
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
# Install OS deps (optional: add libc6-compat for some native modules)
RUN apk add --no-cache libc6-compat

# Copy package manifests
COPY package.json package-lock.json* ./

# Install deps (include dev for build)
RUN npm ci

# Copy source
COPY . .

# Build Next.js (stable Webpack build to avoid Turbopack panic in CI)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Prune dev dependencies to minimize runtime image
RUN npm prune --omit=dev

# 2. Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# Ensure production uses same timezone/utf8
ENV TZ=UTC

RUN apk add --no-cache libc6-compat dumb-init ca-certificates

# Copy only necessary built assets and node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/src/load-env.js ./src/load-env.js
COPY --from=builder /app/start-cloud-run.sh ./start-cloud-run.sh

# Make script executable
RUN chmod +x /app/start-cloud-run.sh

# Cloud Run expects the listening process to stay in foreground.
EXPOSE 8080

# Use dumb-init to handle PID 1 signals properly, ensuring worker/web shutdown gracefully
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/app/start-cloud-run.sh"]
