# ── Stage 1: Build Vite frontend ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for layer cache
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci

# Copy source and build
COPY . .

# VITE_API_URL=/api → same-origin calls, no hardcoded host needed
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}
ENV VITE_API_URL=/api

RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

# Copy API source
COPY apps/api/src apps/api/src

# Copy compiled frontend from builder
COPY --from=builder /app/apps/web/dist apps/web/dist

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/api/src/server.js"]
