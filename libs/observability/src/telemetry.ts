import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export interface TelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  env?: NodeJS.ProcessEnv;
}

export interface TelemetryHandle {
  enabled: boolean;
  shutdown(): Promise<void>;
}

/**
 * Starts OpenTelemetry tracing + metrics. Call from a module imported *first* in main.ts so
 * instrumentations patch http/pg/kafkajs before they load.
 *
 * Configuration is the standard OTEL_* environment, so any OTLP backend works unchanged
 * (Grafana Tempo/Mimir, Jaeger, Honeycomb, Datadog, New Relic, Elastic, a cloud's collector…):
 *   OTEL_EXPORTER_OTLP_ENDPOINT   enables export (no endpoint → telemetry is a no-op)
 *   OTEL_SDK_DISABLED=true        force off
 *   OTEL_RESOURCE_ATTRIBUTES      extra resource attributes
 */
export function startTelemetry(opts: TelemetryOptions): TelemetryHandle {
  const env = opts.env ?? process.env;
  if (env.OTEL_SDK_DISABLED === 'true' || !env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return { enabled: false, shutdown: async () => undefined };
  }
  // Emit stable HTTP semantic conventions (http.server.request.duration in seconds).
  env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http';

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? opts.serviceName,
      [ATTR_SERVICE_VERSION]: opts.serviceVersion ?? env.SERVICE_VERSION ?? '0.0.0',
      'deployment.environment.name': env.DEPLOY_ENV ?? env.NODE_ENV ?? 'development',
      'lightshop.region': env.REGION ?? 'local',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: Number(env.OTEL_METRIC_EXPORT_INTERVAL ?? 15_000),
    }),
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url === '/health' }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new GraphQLInstrumentation({ mergeItems: true, ignoreTrivialResolveSpans: true }),
      new PgInstrumentation(),
      new KafkaJsInstrumentation(),
    ],
  });
  sdk.start();

  let stopped = false;
  const shutdown = async () => {
    if (stopped) return;
    stopped = true;
    await sdk.shutdown();
  };
  process.once('SIGTERM', () => void shutdown());
  return { enabled: true, shutdown };
}
