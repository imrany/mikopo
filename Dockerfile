# Multi-stage Dockerfile for Mikopo Lending Application

# Stage 1: Build environment
FROM node:24-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install OpenSSL required by Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lockfile and package configuration
COPY package.json pnpm-lock.yaml* ./

# Copy Prisma schema folder
COPY src/prisma ./src/prisma/

# Standard pnpm v11 workflow: Pass the environment variable to automatically
# trust and execute native installation scripts (esbuild, prisma, etc.)
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true
RUN pnpm i --frozen-lockfile

# Copy application source
COPY . .

# Build bundle (Runs prisma generation automatically via your build script)
ENV NODE_ENV=production
RUN pnpm run build

# Prune devDependencies to keep the runtime node_modules tiny
RUN pnpm prune --prod --no-optional

# Stage 2: Runtime image
FROM node:24-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

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

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
