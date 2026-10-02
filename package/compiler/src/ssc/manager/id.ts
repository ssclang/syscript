import { assert } from '@syscript/share';
import crypto from 'crypto';
import path from 'path';
import z from 'zod';
import { File } from '~/util/file.js';

type SscIdManagerOption = {
  outDir: string;
  idJsonPath?: string;
};

export class SscIdManager {
  readonly idJsonPath: string;

  private readonly idMap = new Map<string, string>();
  private readonly idSet = new Set<string>();

  private constructor(option: SscIdManagerOption) {
    const { outDir, idJsonPath = path.join(outDir, 'id.json') } = option;
    this.idJsonPath = path.resolve(idJsonPath);
  }

  static async init(option: SscIdManagerOption) {
    const manager = new SscIdManager(option);

    await manager.loadIdJson();

    return manager;
  }

  loadId(key: string) {
    const id = this.idMap.get(key);

    if (id) {
      return id;
    }

    const newId = SscIdManager.newId();

    assert(!this.idSet.has(newId), `new id conflict: ${newId}`);

    this.idMap.set(key, newId);
    this.idSet.add(newId);

    return newId;
  }

  async flush() {
    const entries = this.idMap
      .entries()
      .toArray()
      .sort(([a], [b]) => {
        if (a < b) {
          return -1;
        }

        if (a > b) {
          return 1;
        }

        return 0;
      });
    const content = JSON.stringify(Object.fromEntries(entries), undefined, 2);

    await File.writeIfChanged(this.idJsonPath, `${content}\n`, true);
  }

  private async loadIdJson() {
    assert(!this.idMap.size, 'id map already loaded');
    assert(!this.idSet.size, 'id set already loaded');

    const idMap = await SscIdManager.readIdJson(this.idJsonPath);

    for (const [key, value] of Object.entries(idMap)) {
      assert(!this.idSet.has(value), `id conflict: ${value} in ${this.idJsonPath}`);

      this.idMap.set(key, value);
      this.idSet.add(value);
    }
  }

  private static async readIdJson(path: string) {
    const content = (await File.exists(path)) ? await File.read(path) : '{}';
    const json: unknown = JSON.parse(content);

    return z.record(z.string().nonempty(), z.string().nonempty()).parse(json);
  }

  private static newId() {
    return crypto.randomUUID().replaceAll('-', '');
  }
}
