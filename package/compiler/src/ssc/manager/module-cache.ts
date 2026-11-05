import { MaybePromise } from '@syscript/share/type';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { SscIdManager } from '~/ssc/manager/id.js';
import { File } from '~/util/file.js';
import { Path } from '~/util/path.js';

type SscModuleCacheManagerOption = {
  profileDir: string;
  idManager: SscIdManager;
};

type CachedModule = {
  pathId: string;
  key: string;
  // cppPath: string;
  // cppmPath: string;
  pcmPath: string;
  oPath: string;
};

export class SscModuleCacheManager {
  readonly moduleCacheDir: string;
  readonly idManager: SscIdManager;

  constructor(option: SscModuleCacheManagerOption) {
    const cacheDir = path.join(option.profileDir, 'cache');
    this.moduleCacheDir = path.join(cacheDir, 'module');
    this.idManager = option.idManager;
  }

  async loadOrCompile(
    cppmPath: string,
    keyParts: readonly string[],
    compile: (pcmPath: string, oPath: string) => MaybePromise<void>,
  ): Promise<CachedModule> {
    const key = crypto.hash('sha256', JSON.stringify(keyParts));
    const realPath = await Path.real(Path.absolute({ path: cppmPath }));
    const pathId = this.idManager.loadId(realPath);

    const keyDir = path.join(this.moduleCacheDir, pathId, key);
    const pcmPath = path.join(keyDir, `${pathId}.pcm`);
    const oPath = path.join(keyDir, `${pathId}.o`);

    const cachedModule = { pathId, key, pcmPath, oPath } as const satisfies CachedModule;

    if (await SscModuleCacheManager.isValidCache(cachedModule)) {
      return cachedModule;
    }

    await fs.mkdir(keyDir, { recursive: true });
    await compile(cachedModule.pcmPath, cachedModule.oPath);

    return cachedModule;
  }

  private static async isValidCache(cachedModule: CachedModule) {
    for (const filePath of [cachedModule.pcmPath, cachedModule.oPath]) {
      if (!(await File.exists(filePath, 'file'))) {
        return false;
      }

      if (!(await File.getSize(filePath, 'file'))) {
        return false;
      }
    }

    return true;
  }
}
