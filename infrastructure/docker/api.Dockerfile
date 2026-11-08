# ==============================================================================
# Kinetix Core API & WebSocket Server Dockerfile (Fastify v5 — Port 8000)
# Build Context: Monorepo Root (.)
# ==============================================================================
FROM node:20-alpine
RUN apk add --no-cache libc6-compat wget

WORKDIR /workspace

# Copy shared physical contracts (packages/contracts)
COPY packages/contracts ./packages/contracts

# Install API dependencies
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
WORKDIR /workspace/apps/api
RUN npm install --no-audit --no-fund

# Copy API source and configuration
COPY apps/api ./

# Validate TypeScript against shared contracts
RUN npm run typecheck

ENV NODE_ENV=production
ENV API_PORT=8000
ENV API_HOST=0.0.0.0

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=5 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8000/health > /dev/null || exit 1

CMD ["npm", "run", "start"]
