import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TenantSource } from './registry';

/** Reads every *.json file in a directory. Drop a file in → new store. */
export class FileTenantSource implements TenantSource {
  constructor(private readonly dir: string) {}

  async list(): Promise<unknown[]> {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json')).sort();
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(this.dir, f), 'utf8'))));
  }
}
