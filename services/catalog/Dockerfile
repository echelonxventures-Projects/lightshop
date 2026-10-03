# Build from repo root: docker build -f services/catalog/Dockerfile -t lightshop/catalog .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm nx run @lightshop/catalog-service:build \
 && pnpm deploy --filter @lightshop/catalog-service --prod --legacy /out \
 && cp -r config /out/config

FROM node:22-alpine
ENV NODE_ENV=production TENANTS_DIR=/app/config/tenants
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 4001
CMD ["node", "dist/main.js"]
