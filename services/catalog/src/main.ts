import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CatalogModule } from './catalog.module';
import { loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(CatalogModule.forRoot(config));
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`catalog subgraph ready at http://localhost:${config.port}/graphql`);
}

void bootstrap();
