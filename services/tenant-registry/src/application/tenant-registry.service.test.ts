import { InMemoryEventBus } from '@lightshop/adapters';
import { Principal } from '@lightshop/auth';
import { OutboxRelay } from '@lightshop/outbox';
import { describe, expect, it } from 'vitest';
import { InMemoryTenantStore } from '../infrastructure/memory-tenant-store';
import { TenantRegistryService } from './tenant-registry.service';

const admin: Principal = { userId: 'ops', tenantId: '*', roles: ['platform:admin'] };
const tenantAdmin = (tenantId: string): Principal => ({ userId: 'owner', tenantId, roles: ['tenant:admin'] });

const cfg = (domains = ['bloom.localhost']) => ({
  brand: { name: 'Bloom' }, theme: { colorPrimary: '#B0306A' }, domains, regions: ['eu'],
  locales: ['en-GB'], currencies: ['EUR'], businessModels: ['d2c'], verticals: ['general'],
});

const setup = () => {
  const store = new InMemoryTenantStore();
  return { store, svc: new TenantRegistryService(store) };
};

describe('TenantRegistryService', () => {
  it('creates new stores as drafts, versioned and audited', async () => {
    const { svc } = setup();
    const r = await svc.upsert(admin, 'bloom', { ...cfg(), status: 'live' });
    expect(r).toMatchObject({ version: 1, updatedBy: 'ops', config: { id: 'bloom', status: 'draft' } });
  });

  it('lets only platform admins create, and tenant admins edit only their own store', async () => {
    const { svc } = setup();
    await expect(svc.upsert(tenantAdmin('bloom'), 'bloom', cfg())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await svc.upsert(admin, 'bloom', cfg());
    const edited = await svc.upsert(tenantAdmin('bloom'), 'bloom', { ...cfg(), brand: { name: 'Bloom Beauty' } });
    expect(edited.config.brand.name).toBe('Bloom Beauty');
    await expect(svc.upsert(tenantAdmin('other'), 'bloom', cfg())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(svc.upsert(tenantAdmin('bloom'), 'bloom', cfg(['bloom.example']))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(svc.setStatus(tenantAdmin('bloom'), 'bloom', 'live')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects invalid configs with field-level details', async () => {
    const { svc } = setup();
    await expect(svc.upsert(admin, 'bloom', { ...cfg(), currencies: ['eur'] })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [expect.stringMatching(/^currencies\.0/)],
    });
  });

  it('prevents two stores from claiming the same domain unless one is suspended', async () => {
    const { svc } = setup();
    await svc.upsert(admin, 'bloom', cfg(['shop.example']));
    await expect(svc.upsert(admin, 'copycat', cfg(['SHOP.example']))).rejects.toMatchObject({ code: 'CONFLICT', details: ['shop.example (bloom)'] });
    await svc.setStatus(admin, 'bloom', 'suspended');
    await expect(svc.upsert(admin, 'copycat', cfg(['shop.example']))).resolves.toBeDefined();
  });

  it('enforces optimistic concurrency', async () => {
    const { svc } = setup();
    await svc.upsert(admin, 'bloom', cfg());
    await svc.upsert(admin, 'bloom', cfg(), 1);
    await expect(svc.upsert(admin, 'bloom', cfg(), 1)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('publishes lifecycle events through the outbox', async () => {
    const { svc, store } = setup();
    await svc.upsert(admin, 'bloom', cfg());
    await svc.upsert(admin, 'bloom', { ...cfg(), brand: { name: 'B2' } });
    await svc.setStatus(admin, 'bloom', 'live');
    await svc.setStatus(admin, 'bloom', 'live'); // idempotent, no event
    await svc.setStatus(admin, 'bloom', 'suspended');
    const bus = new InMemoryEventBus();
    await new OutboxRelay(store, bus).flush();
    expect(bus.published.map((p) => `${p.event.type}@${p.event.version}`)).toEqual([
      'tenancy.tenant.created@1', 'tenancy.tenant.updated@2', 'tenancy.tenant.published@3', 'tenancy.tenant.suspended@4',
    ]);
    expect(bus.published[2]!.event.payload).toMatchObject({ status: 'live', config: { brand: { name: 'B2' } } });
  });

  it('imports file-based configs once, keeping their status', async () => {
    const { svc } = setup();
    expect(await svc.importConfigs([{ ...cfg(), id: 'bloom', status: 'live' }])).toBe(1);
    expect(await svc.importConfigs([{ ...cfg(), id: 'bloom', status: 'live' }])).toBe(0);
    expect((await svc.get('bloom')).config.status).toBe('live');
  });
});
