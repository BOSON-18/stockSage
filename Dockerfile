FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# STAGE 2: Production runtime slim
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

RUN mkdir -p /app/data

# Security dont run as root
RUN addgroup -S sage && adduser -S sage -G sage
USER sage

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
    CMD node -e "console.log('healthy')" || exit 1

CMD ["node","dist/index.js"]

