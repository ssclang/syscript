import path from 'path';
import { SscBuildManager, SscBuildProfile } from '~/ssc/manager/build.js';
import { SscIdManager } from '~/ssc/manager/id.js';
import { SscModuleCacheManager } from '~/ssc/manager/module-cache.js';
import { File } from '~/util/file.js';

type SscManagerOption = {
  outDir?: string;
  profile: SscBuildProfile;
  idJsonPath?: string;
};

export class SscManager {
  readonly outDir: string;
  readonly idManager: SscIdManager;
  readonly buildManager: SscBuildManager;

  private constructor(outDir: string, idManager: SscIdManager, buildManager: SscBuildManager) {
    this.outDir = outDir;
    this.idManager = idManager;
    this.buildManager = buildManager;
  }

  static async init(option: SscManagerOption) {
    const outDir = path.resolve(option.outDir || '.ssc');
    const idJsonPath = option.idJsonPath || path.join(outDir, 'id.json');
    const profileDir = path.join(outDir, option.profile);

    const idManager = await SscIdManager.init({ idJsonPath });
    const moduleCacheManager = new SscModuleCacheManager({ profileDir, idManager });
    const buildManager = new SscBuildManager({ outDir, profileDir, idManager, moduleCacheManager });
    const manager = new SscManager(outDir, idManager, buildManager);

    return manager;
  }

  async flush() {
    await this.idManager.flush();
    await File.write(this.buildManager.markerPath, this.buildManager.markerPath, true);
  }
}
