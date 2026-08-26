# Multi-stage Dockerfile for Mikopo Lending Application (High-Performance VPS Production)

# Stage 1: Build environment
FROM node:24-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install OpenSSL and build utilities
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package configurations
COPY package.json pnpm-lock.yaml* package-lock.json* ./

# Copy Prisma schema folder
COPY src/prisma ./src/prisma/

# Install dependencies (supports pnpm and npm)
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true
RUN if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; else npm install; fi

# Copy application source code
COPY . .

# Build application bundle
ENV NODE_ENV=production
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; else npm run build; fi

# Stage 2: Runtime image
FROM node:24-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates wget curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Create upload directory with proper write permissions
RUN mkdir -p /app/uploads

# Copy runtime assets from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/src/generated ./src/generated

# Ensure entrypoint exists, is executable, and fix Windows line endings
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && sed -i 's/\r$//' ./docker-entrypoint.sh

# Healthcheck to verify app readiness on VPS
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
