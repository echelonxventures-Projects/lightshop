import { EventBus, InMemoryEventBus, KafkaEventBus } from '@lightshop/adapters';
import { createTokenVerifier } from '@lightshop/auth';
import { OutboxRelay } from '@lightshop/outbox';
import { FileTenantSource } from '@lightshop/tenancy';
import { DynamicModule, Inject, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TenantRegistryService } from './application/tenant-registry.service';
import { RegistryConfig } from './config';
import { HealthController } from './health.controller';
import { RegistryErrorFilter } from './http/error.filter';
import { TenantsController } from './http/tenants.controller';
import { PostgresTenantStore } from './infrastructure/postgres-tenant-store';
import { TenantStore } from './infrastructure/tenant-store';
import { createTenantStore } from './stores';
import { CONFIG, EVENT_BUS, LAUNCH_RUNNER, OUTBOX_RELAY, TENANT_STORE, TOKEN_VERIFIER } from './tokens';
import { createLaunchActivities, TxtResolver } from './workflows/activities';
import { InlineLaunchRunner, LaunchRunner, TemporalLaunchRunner } from './workflows/launch-runner';

export interface RegistryOverrides {
  eventBus?: EventBus;
  store?: TenantStore;
  launchRunner?: LaunchRunner;
  txtResolver?: TxtResolver;
}

@Module({})
export class RegistryModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('TenantRegistry');

  constructor(
    @Inject(CONFIG) private readonly config: RegistryConfig,
    @Inject(TenantRegistryService) private readonly registry: TenantRegistryService,
    @Inject(OUTBOX_RELAY) private readonly relay: OutboxRelay,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(TENANT_STORE) private readonly store: TenantStore,
    @Inject(LAUNCH_RUNNER) private readonly launcher: LaunchRunner,
  ) {}

  static forRoot(config: RegistryConfig, overrides: RegistryOverrides = {}): DynamicModule {
    return {
      module: RegistryModule,
      controllers: [TenantsController, HealthController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: TENANT_STORE, useFactory: () => overrides.store ?? createTenantStore(config) },
        { provide: TenantRegistryService, inject: [TENANT_STORE], useFactory: (s: TenantStore) => new TenantRegistryService(s) },
        { provide: TOKEN_VERIFIER, useFactory: () => createTokenVerifier(config.auth) },
        {
          provide: EVENT_BUS,
          useFactory: () =>
            overrides.eventBus ?? (config.eventBus === 'kafka' ? new KafkaEventBus(config.kafkaBrokers, 'tenant-registry') : new InMemoryEventBus()),
        },
        {
          provide: OUTBOX_RELAY,
          inject: [TENANT_STORE, EVENT_BUS],
          useFactory: (s: TenantStore, bus: EventBus) =>
            new OutboxRelay(s, bus, { intervalMs: config.outboxIntervalMs, logger: new Logger(OutboxRelay.name) }),
        },
        {
          provide: LAUNCH_RUNNER,
          inject: [TenantRegistryService],
          useFactory: async (svc: TenantRegistryService) =>
            overrides.launchRunner ??
            (config.temporalAddress
              ? TemporalLaunchRunner.connect(config.temporalAddress, config.temporalNamespace)
              : new InlineLaunchRunner(createLaunchActivities(svc, overrides.txtResolver))),
        },
        { provide: APP_FILTER, useClass: RegistryErrorFilter },
      ],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.seedTenantsDir) {
      const n = await this.registry.importConfigs(await new FileTenantSource(this.config.seedTenantsDir).list());
      if (n) this.logger.log(`imported ${n} tenant(s) from ${this.config.seedTenantsDir}`);
    }
    if (!this.config.gatewaySecret) this.logger.warn('GATEWAY_SHARED_SECRET not set: tenant reads are open (development only)');
    this.logger.log(
      `storage: ${this.config.databaseUrl ? 'postgres' : 'memory'} | events: ${this.config.eventBus} | launches: ${this.config.temporalAddress ? 'temporal' : 'inline'}`,
    );
    this.relay.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.relay.stop();
    await this.bus.close();
    await this.launcher.close();
    if (this.store instanceof PostgresTenantStore) await this.store.close();
  }
}
