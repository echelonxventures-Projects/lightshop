# Build from repo root: docker build -f apps/web-storefront/Dockerfile -t lightshop/web-storefront .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
ENV NEXT_OUTPUT=standalone
RUN pnpm install --frozen-lockfile && pnpm nx run @lightshop/web-storefront:build

FROM node:22-alpine
ENV NODE_ENV=production PORT=5678 HOSTNAME=0.0.0.0 TENANTS_DIR=/app/config/tenants
WORKDIR /app
COPY --from=build /repo/apps/web-storefront/.next/standalone ./
COPY --from=build /repo/apps/web-storefront/.next/static ./apps/web-storefront/.next/static
COPY --from=build /repo/config ./config
USER node
EXPOSE 5678
CMD ["node", "apps/web-storefront/server.js"]
