FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /app/sounds \
  && chown -R node:node /app

COPY --from=builder --chown=node:node \
  /app/node_modules \
  ./node_modules

COPY --from=builder --chown=node:node \
  /app/dist \
  ./dist

COPY --chown=node:node \
  package.json \
  package-lock.json \
  ./

USER node

CMD ["sh", "-c", "node dist/scripts/sync-panels.js && exec node dist/main.js"]
