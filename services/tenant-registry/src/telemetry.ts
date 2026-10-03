import { startTelemetry } from '@lightshop/observability';

export const telemetry = startTelemetry({ serviceName: 'tenant-registry', serviceVersion: process.env.SERVICE_VERSION });
