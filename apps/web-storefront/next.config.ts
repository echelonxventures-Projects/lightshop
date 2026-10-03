import type { NextConfig } from 'next';
import { join } from 'node:path';

const config: NextConfig = {
  outputFileTracingRoot: join(__dirname, '../..'),
  // Container builds set NEXT_OUTPUT=standalone; local `next start` needs the default.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  // Node-only libs (fs-based tenant loading) stay on the server.
  serverExternalPackages: ['@lightshop/tenancy', '@lightshop/auth'],
};

export default config;
