# Backend Dockerfile
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

# Build
WORKDIR /app/apps/server
RUN pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm and wget for healthcheck
RUN npm install -g pnpm@9.0.0 && \
    apk add --no-cache wget

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./package.json
COPY --from=builder /app/packages/shared ./packages/shared

# Create db directory
RUN mkdir -p /app/db

EXPOSE 8787

CMD ["node", "dist/index.js"]
