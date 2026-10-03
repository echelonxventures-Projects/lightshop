import { startTelemetry } from '@lightshop/observability';

export const telemetry = startTelemetry({ serviceName: 'gateway', serviceVersion: process.env.SERVICE_VERSION });
