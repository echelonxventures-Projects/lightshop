import { startTelemetry } from '@lightshop/observability';

// Imported first by main.ts so OpenTelemetry patches http/express/pg/kafkajs before they load.
export const telemetry = startTelemetry({ serviceName: 'catalog', serviceVersion: process.env.SERVICE_VERSION });
