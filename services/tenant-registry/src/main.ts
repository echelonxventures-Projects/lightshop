import { telemetry } from './telemetry';
import 'reflect-metadata';
import { JsonLogger } from '@lightshop/observability';
import { NestFactory } from '@nestjs/core';
import { loadConfig } from './config';
import { RegistryModule } from './registry.module';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const json = (process.env.LOG_FORMAT ?? (config.production ? 'json' : 'pretty')) === 'json';
  const app = await NestFactory.create(RegistryModule.forRoot(config), json ? { logger: new JsonLogger('tenant-registry') } : {});
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`tenant-registry ready at http://localhost:${config.port}/v1/tenants (telemetry: ${telemetry.enabled ? 'on' : 'off'})`);
}

void bootstrap();
