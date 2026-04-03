# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install native build tools required by mediasoup
# - python3 + py3-pip: mediasoup postinstall runs "python -m pip install invoke"
# - ln -sf: Alpine has no "python" symlink, only "python3"
# - make, g++, linux-headers: compile mediasoup C++ worker from source
RUN apk add --no-cache python3 py3-pip make g++ linux-headers \
    && ln -sf python3 /usr/bin/python

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "dist/main"]