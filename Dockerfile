# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Copy manifests
COPY package.json pnpm-lock.yaml .npmrc ./

# Install all deps (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build frontend (Vite → dist/frontend) and backend (tsc → dist/backend)
RUN pnpm build

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Copy manifests for prod-only install
COPY package.json pnpm-lock.yaml .npmrc ./

# Install production deps only (rebuilds native modules for this exact arch)
RUN pnpm install --frozen-lockfile --prod

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Persistent data directory (mounted as volume in docker-compose)
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3939
ENV DATA_DIR=/data

EXPOSE 3939

CMD ["node", "dist/backend/start.js"]
