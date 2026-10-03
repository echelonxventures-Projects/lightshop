import { readFileSync } from 'node:fs';
import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { schemaPath } from './index';

describe('catalog SDL', () => {
  it('parses and exposes the Product entity key', () => {
    const doc = parse(readFileSync(schemaPath('catalog'), 'utf8'));
    const product = doc.definitions.find((d) => 'name' in d && d.name?.value === 'Product');
    expect(product).toBeDefined();
    expect(JSON.stringify(product)).toContain('"key"');
  });
});
