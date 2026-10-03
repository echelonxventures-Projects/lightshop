import { getStore } from '../lib/tenant';

export default async function NotFound() {
  const store = await getStore();
  return (
    <div className="sf-empty" style={{ padding: '96px 16px' }}>
      <h1>{store ? 'Page not found' : 'Store not found'}</h1>
      <p>{store ? 'This page does not exist.' : 'No store is configured for this address.'}</p>
    </div>
  );
}
