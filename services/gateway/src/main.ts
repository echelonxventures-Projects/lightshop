import { telemetry } from './telemetry';
import { JsonLogger } from '@lightshop/observability';
import { loadConfig } from './config';
import { startGateway } from './gateway';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new JsonLogger('gateway');
  const log = config.production ? (m: string) => logger.log(m) : (m: string) => console.log(`[gateway] ${m}`);
  const gw = await startGateway(config, log);
  log(`gateway ready at ${gw.url}/graphql — subgraphs: ${config.subgraphs.map((s) => s.name).join(', ')} (telemetry: ${telemetry.enabled ? 'on' : 'off'})`);
  const shutdown = () => void gw.close().then(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
