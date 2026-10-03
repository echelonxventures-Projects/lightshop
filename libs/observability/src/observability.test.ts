import { context, trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JsonLogger, annotateActiveSpan, startTelemetry } from './index';

const exporter = new InMemorySpanExporter();

beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }));
});
afterAll(() => {
  trace.disable();
  context.disable();
});

describe('startTelemetry', () => {
  it('is a no-op without an OTLP endpoint or when disabled', async () => {
    expect(startTelemetry({ serviceName: 's', env: {} }).enabled).toBe(false);
    expect(startTelemetry({ serviceName: 's', env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://x', OTEL_SDK_DISABLED: 'true' } }).enabled).toBe(false);
  });
});

describe('JsonLogger', () => {
  it('writes one JSON line with level, context and trace correlation', () => {
    const lines: string[] = [];
    const log = new JsonLogger('catalog', 'info', (l) => lines.push(l));
    trace.getTracer('t').startActiveSpan('op', (span) => {
      log.log('hello', 'CatalogModule');
      span.end();
    });
    log.debug('hidden');
    const rec = JSON.parse(lines[0]!);
    expect(lines).toHaveLength(1);
    expect(rec).toMatchObject({ level: 'info', service: 'catalog', msg: 'hello', context: 'CatalogModule' });
    expect(rec.trace_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('captures Nest-style error stacks', () => {
    const lines: string[] = [];
    new JsonLogger('x', 'info', (l) => lines.push(l)).error('boom', 'Error: boom\n    at x', 'Ctx');
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: 'error', msg: 'boom', context: 'Ctx', stack: 'Error: boom\n    at x' });
  });
});

describe('annotateActiveSpan', () => {
  it('tags the active span with tenant and region', () => {
    trace.getTracer('t').startActiveSpan('req', (span) => {
      annotateActiveSpan({ tenantId: 'acme-mart', region: 'us' });
      span.end();
    });
    const span = exporter.getFinishedSpans().find((s) => s.name === 'req')!;
    expect(span.attributes).toMatchObject({ 'lightshop.tenant_id': 'acme-mart', 'lightshop.region': 'us' });
  });
});
