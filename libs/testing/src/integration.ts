import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

/**
 * Integration tests run only when their backing service is provided, e.g.
 *   describe.skipIf(!integration('TEST_DATABASE_URL'))(...)
 * CI sets these via service containers; locally they are skipped unless you export them.
 */
export function integration(envVar: string): string | undefined {
  return process.env[envVar] || undefined;
}

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

/** Creates an isolated, uniquely named database on the server behind `baseUrl`; drop() removes it. */
export async function createTestDatabase(baseUrl: string): Promise<TestDatabase> {
  const name = `lstest_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const c = new Client({ connectionString: baseUrl });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}

/** Poll until `check` returns a value or the timeout elapses (for async consumers in integration tests). */
export async function eventually<T>(check: () => T | undefined | Promise<T | undefined>, timeoutMs = 15_000, intervalMs = 100): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Condition not met within ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** A currently free TCP port on localhost (for spawning services in tests). */
export async function freePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, () => {
      const port = (srv.address() as import('node:net').AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}
