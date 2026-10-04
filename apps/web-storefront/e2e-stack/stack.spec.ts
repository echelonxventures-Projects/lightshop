import { APIRequestContext, expect, request, test } from '@playwright/test';

const HTTP = process.env.LS_HTTP_PORT ?? '8088';
const IDP = `http://localhost:${process.env.LS_KEYCLOAK_PORT ?? '8180'}/realms/lightshop`;
const REGISTRY = `http://localhost:${process.env.LS_REGISTRY_PORT ?? '4002'}`;
const PROMETHEUS = `http://localhost:${process.env.LS_PROMETHEUS_PORT ?? '9090'}`;
const store = (sub: string, path = '/') => `http://${sub}.localhost:${HTTP}${path}`;

let api: APIRequestContext;
test.beforeAll(async () => {
  api = await request.newContext();
});

/** Real IdP token (dev realm CI client), exactly what an operator tool would use. */
async function idpToken(user: string): Promise<string> {
  const res = await api.post(`${IDP}/protocol/openid-connect/token`, {
    form: { grant_type: 'password', client_id: 'lightshop-ci', client_secret: 'ci-secret', username: user, password: user, scope: 'openid' },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).access_token;
}

test('both white-label stores serve the seeded catalog through the ingress', async ({ page }) => {
  await page.goto(store('acme'));
  await expect(page).toHaveTitle('Acme Mart');
  await page.getByRole('link', { name: /Nova X2 Smartphone/ }).click();
  const buyBox = page.getByRole('region', { name: 'Buy box' });
  await expect(buyBox).toContainText('$479.00');
  await expect(page.getByText('Other sellers (2)')).toBeVisible();

  await page.goto(store('verde'));
  await expect(page).toHaveTitle('Verde Wholesale');
  await page.getByRole('link', { name: /M8 Stainless Steel Hex Bolts/ }).click();
  await expect(page.getByRole('region', { name: 'Buy box' })).toContainText('Minimum order: 25');
});

test('the public API is served same-origin at /graphql on each store domain', async ({ page }) => {
  await page.goto(store('verde'));
  const result = await page.evaluate(async () => {
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'hi-IN' },
      body: JSON.stringify({ query: '{ products { edges { node { title } } } }' }),
    });
    return { status: res.status, body: await res.json() };
  });
  expect(result.status).toBe(200);
  expect(result.body.data.products.edges.map((e: { node: { title: string } }) => e.node.title)).toContain('M8 स्टेनलेस स्टील हेक्स बोल्ट');
});

test('sign in through the real Keycloak login page, bound to one store', async ({ page }) => {
  await page.goto(store('acme'));
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.locator('#username').fill('ana');
  await page.locator('#password').fill('ana');
  await page.locator('#kc-login').click();
  await expect(page.getByTestId('account-name')).toHaveText('Ana Shopper');
  const session = (await page.context().cookies(store('acme'))).find((c) => c.name === 'ls_session');
  expect(session?.httpOnly).toBe(true);
  expect(session!.value.length).toBeLessThan(3800); // stays under the 4 KB browser cookie limit

  await page.goto(store('verde'));
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await page.goto(store('acme'));
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test("a buyer from another store can't sign in here", async ({ page }) => {
  await page.goto(store('acme', '/auth/login'));
  await page.locator('#username').fill('raj');
  await page.locator('#password').fill('raj');
  await page.locator('#kc-login').click();
  await expect(page.getByTestId('auth-error')).toContainText('belongs to a different store');
});

test('zero-code launch: a new store goes live through the Temporal workflow and worker', async ({ page }) => {
  const ops = await idpToken('ops');
  const auth = { authorization: `Bearer ${ops}` };
  const put = await api.put(`${REGISTRY}/v1/tenants/bloom`, {
    headers: auth,
    data: {
      brand: { name: 'Bloom Beauty', tagline: 'Clean beauty, delivered.' },
      theme: { colorPrimary: '#B0306A', radius: 'lg' },
      domains: ['bloom.localhost'], regions: ['eu'], locales: ['en-GB'], currencies: ['EUR'],
      businessModels: ['d2c'], verticals: ['general'],
    },
  });
  expect(put.ok(), await put.text()).toBe(true);

  const launch = await api.post(`${REGISTRY}/v1/tenants/bloom/launch`, { headers: auth });
  expect(launch.status()).toBe(202);
  expect(await launch.json()).toMatchObject({ mode: 'temporal', workflowId: 'tenant-launch-bloom' });

  await expect
    .poll(async () => (await (await api.get(`${REGISTRY}/v1/tenants/bloom/launch`, { headers: auth })).json()).status, { timeout: 60_000 })
    .toBe('COMPLETED');

  await expect.poll(async () => (await page.goto(store('bloom')))?.status(), { timeout: 30_000 }).toBe(200);
  await expect(page).toHaveTitle('Bloom Beauty');
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ls-color-primary').trim());
  expect(primary).toBe('#B0306A');
});

test('telemetry reaches the observability stack', async () => {
  const query = async (q: string) => {
    const res = await api.get(`${PROMETHEUS}/api/v1/query`, { params: { query: q } });
    return ((await res.json()).data?.result ?? []) as Array<{ metric: Record<string, string>; value: [number, string] }>;
  };
  await expect.poll(async () => (await query('sum by (service_name) (http_server_request_duration_seconds_count)')).map((r) => r.metric.service_name).sort(), { timeout: 60_000 })
    .toEqual(expect.arrayContaining(['catalog', 'gateway', 'tenant-registry']));
  await expect.poll(async () => (await query('sum(lightshop_outbox_published_total)'))[0]?.value[1], { timeout: 60_000 })
    .toMatch(/^[1-9]/);
});
