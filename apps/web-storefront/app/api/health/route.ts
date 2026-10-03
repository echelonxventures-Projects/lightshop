import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness/readiness for the orchestrator. Deliberately independent of tenants and downstream APIs. */
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'web-storefront' });
}
