import { unwrapResolverError } from '@apollo/server/errors';
import { EventBus, InMemoryEventBus, KafkaEventBus } from '@lightshop/adapters';
import { DevTokenVerifier, GATEWAY_TOKEN_HEADER, JwksTokenVerifier, TokenVerifier } from '@lightshop/auth';
import { depthLimit } from '@lightshop/graphql-security';
import { OutboxRelay } from '@lightshop/outbox';
import { schemaPath } from '@lightshop/contracts';
import { FileTenantSource, HttpTenantSource, LiveTenantRegistry, TenantLookup } from '@lightshop/tenancy';
import { VerticalPackRegistry } from '@lightshop/vertical-packs';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { DynamicModule, Inject, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import type { Request } from 'express';
import { CatalogService } from './application/catalog.service';
import { CatalogError } from './application/errors';
import { CatalogConfig } from './config';
import { CatalogErrorFilter } from './graphql/catalog-error.filter';
import { buildContext } from './graphql/context';
import { JSONScalar } from './graphql/json.scalar';
import { OfferResolver, ProductResolver, VerticalPackResolver } from './graphql/catalog.resolver';
import { HealthController } from './health.controller';
import { InMemoryProductRepository } from './infrastructure/memory-product-repository';
import { PostgresProductRepository } from './infrastructure/postgres-product-repository';
import { seedDemoData } from './seed';
import {
  CONFIG, EVENT_BUS, OUTBOX_RELAY, OUTBOX_STORE, PRODUCT_REPOSITORY, TENANT_REGISTRY, TOKEN_VERIFIER, VERTICAL_PACKS,
} from './tokens';

/** Infrastructure adapters chosen by config — Postgres or memory, Kafka or memory. */
function infrastructureProviders(config: CatalogConfig, overrides: Partial<{ eventBus: EventBus }>): Provider[] {
  return [
    { provide: CONFIG, useValue: config },
    {
      provide: PRODUCT_REPOSITORY,
      useFactory: async () =>
        config.databaseUrl ? PostgresProductRepository.connect(config.databaseUrl) : new InMemoryProductRepository(),
    },
    { provide: OUTBOX_STORE, useExisting: PRODUCT_REPOSITORY },
    {
      provide: EVENT_BUS,
      useFactory: () =>
        overrides.eventBus ?? (config.eventBus === 'kafka' ? new KafkaEventBus(config.kafkaBrokers, 'catalog') : new InMemoryEventBus()),
    },
    {
      provide: TENANT_REGISTRY,
      // Live: new or edited stores apply within tenantsRefreshMs, no restart (zero-code launch).
      useFactory: () => {
        const logger = new Logger('Tenants');
        const source = config.tenantsUrl
          ? new HttpTenantSource({
              url: config.tenantsUrl,
              headers: config.gatewaySecret ? { [GATEWAY_TOKEN_HEADER]: config.gatewaySecret } : {},
            })
          : new FileTenantSource(config.tenantsDir);
        return LiveTenantRegistry.start(source, {
          intervalMs: config.tenantsRefreshMs,
          onChange: (r) => logger.log(`tenant configs reloaded (${r.all().length} stores)`),
          onError: (e) => logger.error(`tenant refresh failed, keeping last good configs: ${e.message}`),
        });
      },
    },
    { provide: VERTICAL_PACKS, useFactory: () => new VerticalPackRegistry() },
    {
      provide: TOKEN_VERIFIER,
      useFactory: (): TokenVerifier =>
        config.auth.mode === 'oidc'
          ? new JwksTokenVerifier({ issuer: config.auth.issuer, audience: config.auth.audience, jwksUrl: config.auth.jwksUrl })
          : new DevTokenVerifier(config.auth.secret),
    },
    {
      provide: OUTBOX_RELAY,
      inject: [OUTBOX_STORE, EVENT_BUS],
      useFactory: (store, bus) =>
        new OutboxRelay(store, bus, { intervalMs: config.outboxIntervalMs, logger: new Logger(OutboxRelay.name) }),
    },
  ];
}

@Module({})
class CoreModule {}

@Module({})
export class CatalogModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CatalogModule.name);

  constructor(
    @Inject(CONFIG) private readonly config: CatalogConfig,
    @Inject(OUTBOX_RELAY) private readonly relay: OutboxRelay,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(TENANT_REGISTRY) private readonly tenants: LiveTenantRegistry,
    @Inject(PRODUCT_REPOSITORY) private readonly repo: unknown,
  ) {}

  static forRoot(config: CatalogConfig, overrides: Partial<{ eventBus: EventBus }> = {}): DynamicModule {
    const infra = infrastructureProviders(config, overrides);
    const core: DynamicModule = { module: CoreModule, global: true, providers: infra, exports: infra.map((p) => (p as { provide: symbol }).provide) };
    return {
      module: CatalogModule,
      imports: [
        core,
        GraphQLModule.forRootAsync<ApolloFederationDriverConfig>({
          driver: ApolloFederationDriver,
          inject: [TENANT_REGISTRY, TOKEN_VERIFIER],
          useFactory: (registry: TenantLookup, verifier: TokenVerifier) => ({
            typePaths: [schemaPath('catalog')],
            resolvers: { JSON: JSONScalar },
            context: ({ req }: { req: Request }) =>
              buildContext(req, {
                registry,
                verifier,
                gatewaySecret: config.gatewaySecret,
                trustHeadersWithoutGateway: !config.production,
              }),
            introspection: config.introspection,
            validationRules: [depthLimit(config.maxQueryDepth)],
            parseOptions: { maxTokens: config.maxQueryTokens },
            formatError: (formatted, error) => {
              const original = unwrapResolverError(error);
              if (original instanceof CatalogError) {
                return { message: original.message, path: formatted.path, extensions: { code: original.code, details: original.details } };
              }
              return formatted;
            },
          }),
        }),
      ],
      controllers: [HealthController],
      providers: [
        CatalogService, ProductResolver, OfferResolver, VerticalPackResolver,
        { provide: APP_FILTER, useClass: CatalogErrorFilter },
      ],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.gatewaySecret) {
      this.logger.warn('GATEWAY_SHARED_SECRET not set: trusting x-tenant-id from any caller (development only)');
    }
    if (this.config.auth.mode === 'dev') {
      this.logger.warn('Using development tokens (DEV_AUTH_SECRET). Set OIDC_ISSUER to use a real identity provider.');
    }
    this.logger.log(
      `tenants: ${this.tenants.all().map((t) => t.id).join(', ')} | storage: ${this.config.databaseUrl ? 'postgres' : 'memory'} | events: ${this.config.eventBus}`,
    );
    if (this.config.seedDemo) {
      const n = await seedDemoData(this.catalog, this.tenants, this.config.demoCatalogFile);
      if (n) this.logger.log(`seeded ${n} demo product(s)`);
    }
    this.relay.start();
  }

  logReady(port: number, telemetryEnabled: boolean): void {
    this.logger.log(`catalog subgraph ready at http://localhost:${port}/graphql (telemetry: ${telemetryEnabled ? 'on' : 'off'})`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.tenants.stop();
    await this.relay.stop();
    await this.bus.close();
    if (this.repo instanceof PostgresProductRepository) await this.repo.close();
  }
}
