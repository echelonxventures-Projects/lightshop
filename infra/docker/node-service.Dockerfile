# One image recipe for every Node service. Build from the repo root:
#   docker build -f infra/docker/node-service.Dockerfile \
#     --build-arg PACKAGE=@lightshop/catalog-service --build-arg ENTRY=dist/main.js -t lightshop/catalog .
# Services with several processes (e.g. tenant-registry API + Temporal worker) reuse the image with a different command.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG PACKAGE
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm nx run "${PACKAGE}:build" \
 && pnpm deploy --filter "${PACKAGE}" --prod --legacy /out \
 && cp -r config /out/config

# Debian slim (glibc), not Alpine: Temporal's native worker core and other native modules need glibc.
FROM node:${NODE_VERSION}-bookworm-slim
ARG ENTRY=dist/main.js
ARG VERSION=dev
ENV NODE_ENV=production \
    TENANTS_DIR=/app/config/tenants \
    SERVICE_VERSION=${VERSION} \
    ENTRY=${ENTRY}
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
# Read-only root filesystem friendly: nothing is written outside /tmp.
CMD ["sh", "-c", "exec node \"$ENTRY\""]
