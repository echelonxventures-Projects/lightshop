import { TokenVerifier } from '@lightshop/auth';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { RegistryError } from '../application/errors';
import { TenantRegistryService } from '../application/tenant-registry.service';
import { RegistryConfig } from '../config';
import { TenantStatus } from '../domain/tenant-record';
import { CONFIG, LAUNCH_RUNNER, TOKEN_VERIFIER } from '../tokens';
import { LaunchRunner } from '../workflows/launch-runner';
import { assertInternalReader, principalFrom } from './auth';

const STATUSES: TenantStatus[] = ['draft', 'live', 'suspended'];

@Controller('v1/tenants')
export class TenantsController {
  constructor(
    @Inject(TenantRegistryService) private readonly registry: TenantRegistryService,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(LAUNCH_RUNNER) private readonly launcher: LaunchRunner,
    @Inject(CONFIG) private readonly config: RegistryConfig,
  ) {}

  /** Consumed by LiveTenantRegistry in every service. ETag makes idle polling ~free. */
  @Get()
  async list(@Query('status') status: string | undefined, @Req() req: Request, @Res() res: Response): Promise<void> {
    await assertInternalReader(req, this.verifier, this.config.gatewaySecret, this.config.production);
    if (status && !STATUSES.includes(status as TenantStatus)) throw new RegistryError('VALIDATION_FAILED', `Unknown status ${status}`);
    const records = await this.registry.list(status as TenantStatus | undefined);
    const etag = `"${createHash('sha256').update(records.map((r) => `${r.config.id}@${r.version}`).join('|')).digest('base64url').slice(0, 27)}"`;
    res.setHeader('etag', etag);
    res.setHeader('cache-control', 'no-cache');
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.json({ tenants: records.map((r) => r.config) });
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await assertInternalReader(req, this.verifier, this.config.gatewaySecret, this.config.production);
    const record = await this.registry.get(id);
    res.setHeader('etag', `"v${record.version}"`);
    return record;
  }

  /** Create or update a store. Send `If-Match: "v<version>"` for safe concurrent edits. */
  @Put(':id')
  async upsert(@Param('id') id: string, @Body() body: unknown, @Headers('if-match') ifMatch: string | undefined, @Req() req: Request) {
    const principal = await principalFrom(req, this.verifier);
    const expected = ifMatch ? Number(ifMatch.replace(/[^0-9]/g, '')) : undefined;
    return this.registry.upsert(principal, id, body, expected);
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Req() req: Request) {
    return this.registry.setStatus(await principalFrom(req, this.verifier), id, 'live');
  }

  @Post(':id/suspend')
  @HttpCode(200)
  async suspend(@Param('id') id: string, @Req() req: Request) {
    return this.registry.setStatus(await principalFrom(req, this.verifier), id, 'suspended');
  }

  /** Start the launch workflow (validate → verify domains → publish). Platform admins only. */
  @Post(':id/launch')
  @HttpCode(202)
  async launch(@Param('id') id: string, @Req() req: Request) {
    const principal = await principalFrom(req, this.verifier);
    if (!principal.roles.includes('platform:admin')) throw new RegistryError('FORBIDDEN', 'Only platform admins can launch stores');
    await this.registry.get(id);
    return this.launcher.start(id);
  }

  @Get(':id/launch')
  async launchStatus(@Param('id') id: string, @Req() req: Request) {
    await principalFrom(req, this.verifier);
    return this.launcher.status(`tenant-launch-${id}`);
  }
}
