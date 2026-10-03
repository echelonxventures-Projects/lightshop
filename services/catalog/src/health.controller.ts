import { Controller, Get, Inject } from '@nestjs/common';
import { OutboxStore } from '@lightshop/outbox';
import { OUTBOX_STORE } from './tokens';

@Controller('health')
export class HealthController {
  constructor(@Inject(OUTBOX_STORE) private readonly outbox: OutboxStore) {}

  @Get()
  async health() {
    return { status: 'ok', service: 'catalog', outboxPending: await this.outbox.pendingCount() };
  }
}
