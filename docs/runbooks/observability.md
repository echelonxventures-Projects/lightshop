# Observability

Services emit **OpenTelemetry** traces and metrics over OTLP, and write **JSON logs** to stdout with `trace_id` and `span_id`. Nothing in application code names a vendor. Point `OTEL_EXPORTER_OTLP_ENDPOINT` at any OTLP backend or collector.

## Local stack

```bash
pnpm infra:up:obs        # OTel Collector + Tempo + Prometheus + Grafana
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 LOG_FORMAT=json pnpm dev:catalog
```

Grafana: http://localhost:3001 → *LightShop → Service overview* (request rate, p95 latency, 5xx ratio, outbox depth, events published by topic, publish failures). Traces are in Explore → Tempo.

## Configuration (standard OTel env)

| Variable | Effect |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Enables export. Unset = telemetry off (no overhead). |
| `OTEL_SDK_DISABLED=true` | Force off |
| `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` | Override or add resource attributes |
| `OTEL_METRIC_EXPORT_INTERVAL` | Metric export interval in ms (default 15000) |
| `LOG_FORMAT=json` / `LOG_LEVEL` | JSON logs (default in production) and level |
| `REGION`, `DEPLOY_ENV` | Become the `lightshop.region` and `deployment.environment.name` attributes |

## What is instrumented

- Auto: HTTP server and client, Express, NestJS, GraphQL (trivial resolvers skipped), `pg`, `kafkajs`
- Span attributes: `lightshop.tenant_id`, `lightshop.region`, `enduser.id` (set when the tenant is resolved)
- Metrics: `http.server.request.duration` (stable semconv), `lightshop.outbox.pending`, `lightshop.outbox.published{topic}`, `lightshop.outbox.publish_failures`

## Production

Run an OpenTelemetry Collector per cell (DaemonSet or sidecar). Change only its exporters to switch backends (Grafana Cloud, Datadog, Honeycomb, Elastic, New Relic, a cloud-native collector). Collector config: `infra/observability/otel-collector.yaml`.

## Suggested alerts

| Alert | Condition |
|---|---|
| Outbox backlog | `lightshop_outbox_pending > 1000` for 10 min |
| Event publishing failing | `rate(lightshop_outbox_publish_failures_total[5m]) > 0` for 5 min |
| Error budget burn | 5xx ratio > 1% for 15 min (checkout > 0.1%) |
| Latency SLO | p95 `http_server_request_duration_seconds` > 200 ms for 15 min |
