# ML services (planned, Phase 3)

Python is allowed only here ([ADR-0001](../docs/adr/0001-typescript-monorepo.md)). The planned models are recommendations, learning-to-rank, fraud scoring, demand forecasting and product matching. Features come from the regional lakehouse/feature store, and models are served behind internal gRPC/HTTP APIs that the TypeScript services call through ports.
