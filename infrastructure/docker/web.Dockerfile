# ==============================================================================
# Kinetix Web Frontend Dockerfile (Next.js 16 — Port 3000)
# Build Context: Monorepo Root (.)
# ==============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat wget

FROM base AS builder
WORKDIR /workspace

# Copy shared contracts and web package manifests
COPY packages/contracts ./packages/contracts
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/

WORKDIR /workspace/apps/web
RUN npm install --no-audit --no-fund

# Copy web source files
COPY apps/web ./

# Build-time public environment variables for Next.js client bundle
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
ARG NEXT_PUBLIC_USE_MOCK=false

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_USE_MOCK=${NEXT_PUBLIC_USE_MOCK}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM base AS runner
WORKDIR /workspace/apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV WEB_PORT=3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /workspace/packages/contracts /workspace/packages/contracts
COPY --from=builder /workspace/apps/web /workspace/apps/web

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["npm", "run", "start"]
