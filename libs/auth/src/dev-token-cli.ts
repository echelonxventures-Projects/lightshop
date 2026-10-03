#!/usr/bin/env node
import { mintDevToken } from './dev-tokens';

/**
 * Usage: pnpm dev:token --tenant acme-mart --roles catalog:admin [--seller sel_x] [--sub user_1]
 * Prints a bearer token accepted by services running with DEV_AUTH_SECRET.
 */
async function main(): Promise<void> {
  const args = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) args.set(argv[i]!.replace(/^--/, ''), argv[i + 1] ?? '');
  const secret = process.env.DEV_AUTH_SECRET ?? 'lightshop-local-dev-secret';
  const tenant = args.get('tenant');
  if (!tenant) {
    console.error('Usage: lightshop-dev-token --tenant <id> --roles <a,b> [--seller <id>] [--sub <id>]');
    process.exit(1);
  }
  const token = await mintDevToken(secret, {
    sub: args.get('sub') ?? 'dev_user',
    tenant_id: tenant,
    roles: (args.get('roles') ?? '').split(',').filter(Boolean),
    seller_id: args.get('seller'),
  });
  console.log(token);
}

void main();
