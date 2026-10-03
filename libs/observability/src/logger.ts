import { context, trace } from '@opentelemetry/api';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogRecord {
  ts: string;
  level: Level;
  service: string;
  msg: string;
  context?: string;
  trace_id?: string;
  span_id?: string;
  [key: string]: unknown;
}

/**
 * One JSON object per line on stdout, correlated with the active trace. Any log pipeline
 * (Loki, Elastic, OpenSearch, CloudWatch, Cloud Logging, Splunk) can ingest it.
 * Structurally implements NestJS LoggerService, so it can be passed to NestFactory.create().
 */
export class JsonLogger {
  private readonly min: number;

  constructor(
    private readonly service: string,
    level: Level = (process.env.LOG_LEVEL as Level) ?? 'info',
    private readonly write: (line: string) => void = (l) => process.stdout.write(l + '\n'),
  ) {
    this.min = ORDER[level] ?? ORDER.info;
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.emit('info', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.emit('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    // Nest calls error(message, stack?, context?)
    const [maybeStack, ...others] = rest;
    const stack = typeof maybeStack === 'string' && maybeStack.includes('\n') ? maybeStack : undefined;
    this.emit('error', message, stack ? others : rest, stack ? { stack } : undefined);
  }

  private emit(level: Level, message: unknown, rest: unknown[], extra?: Record<string, unknown>): void {
    if (ORDER[level] < this.min) return;
    const ctxName = rest.find((r): r is string => typeof r === 'string');
    const span = trace.getSpan(context.active())?.spanContext();
    const record: LogRecord = {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      msg: message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message),
      ...(ctxName ? { context: ctxName } : {}),
      ...(span && trace.isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId } : {}),
      ...(message instanceof Error ? { stack: message.stack } : {}),
      ...extra,
    };
    this.write(JSON.stringify(record));
  }
}
