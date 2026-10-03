import { telemetry } from './telemetry';
import 'reflect-metadata';
import { JsonLogger } from '@lightshop/observability';
import { NestFactory } from '@nestjs/core';
import { CatalogModule } from './catalog.module';
import { loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  // JSON logs (trace-correlated) in production or when LOG_FORMAT=json; Nest's readable logs otherwise.
  const json = (process.env.LOG_FORMAT ?? (config.production ? 'json' : 'pretty')) === 'json';
  const app = await NestFactory.create(CatalogModule.forRoot(config), json ? { logger: new JsonLogger('catalog') } : {});
  app.enableShutdownHooks();
  await app.listen(config.port);
  app.get(CatalogModule).logReady(config.port, telemetry.enabled);
}

void bootstrap();
