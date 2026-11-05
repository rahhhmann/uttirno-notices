FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/agent/package.json apps/agent/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/portal/package.json apps/portal/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/infrastructure/package.json packages/infrastructure/package.json
COPY packages/llm/package.json packages/llm/package.json
COPY packages/source-config/package.json packages/source-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY research/prototype/package.json research/prototype/package.json
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ARG REVISION
LABEL org.opencontainers.image.revision=$REVISION
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps ./apps
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p /run/parser && chown node:node /run/parser
USER node
CMD ["node", "apps/api/dist/main.js"]

# Only this image has native parsers. Deploy with network_mode:none, no credentials/archive mount.
FROM runtime AS parser
USER root
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-ben tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
USER node
CMD ["node", "apps/agent/dist/documents/parser-service.js"]
