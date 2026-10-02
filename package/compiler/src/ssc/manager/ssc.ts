import path from 'path';
import { SscBuildManager, SscBuildProfile } from '~/ssc/manager/build.js';
import { SscIdManager } from '~/ssc/manager/id.js';
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
    const { profile, idJsonPath } = option;

    const idManager = await SscIdManager.init({ outDir, idJsonPath });
    const buildManager = new SscBuildManager({ outDir, profile, idManager });
    const manager = new SscManager(outDir, idManager, buildManager);

    return manager;
  }

  async flush() {
    await this.idManager.flush();
    await File.write(this.buildManager.markerPath, this.buildManager.markerPath, true);
  }
}
