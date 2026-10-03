import { OutboxStore } from '@lightshop/outbox';
import { Controller, Get, Inject } from '@nestjs/common';
import { TENANT_STORE } from './tokens';

@Controller('health')
export class HealthController {
  constructor(@Inject(TENANT_STORE) private readonly store: OutboxStore) {}

  @Get()
  async health() {
    return { status: 'ok', service: 'tenant-registry', outboxPending: await this.store.pendingCount() };
  }
}
