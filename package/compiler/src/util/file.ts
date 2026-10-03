import { assert, CustomMath, isError } from '@syscript/share/util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { logWarn } from '~/log.js';

type FileType = 'file' | 'directory' | 'symbolicLink';

type DiskBaseSize = 1_000 | 1_024;

type OsErrorCode = keyof typeof os.constants.errno;

function isNotFoundError(error: unknown) {
  const notFoundCodes = ['ENOENT', 'ENOTDIR'] as const satisfies readonly OsErrorCode[];
  return isError(error) && 'code' in error && notFoundCodes.some((c) => c === error.code);
}

export class File {
  static async exists(path: string, type?: FileType): Promise<boolean> {
    const stat = await fs.lstat(path).catch((e: unknown) => {
      if (!isNotFoundError(e)) {
        throw e;
      }
      return undefined;
    });

    if (!stat) {
      return false;
    }

    if (type === 'file') {
      return stat.isFile();
    }

    if (type === 'symbolicLink') {
      return stat.isSymbolicLink();
    }

    if (type === 'directory') {
      return stat.isDirectory();
    }

    if (!stat.isFile() && !stat.isSymbolicLink() && !stat.isDirectory()) {
      logWarn(`warning: not explicitly handled file type: ${path}`);
    }

    return true;
  }

  static async getSize(targetPath: string, type?: FileType) {
    const stat = await fs.lstat(targetPath);

    if (stat.isFile()) {
      assert(!type || type === 'file');
      return stat.size;
    }

    if (stat.isSymbolicLink()) {
      assert(!type || type === 'symbolicLink');
      return stat.size;
    }

    assert(stat.isDirectory());
    assert(!type || type === 'directory');

    const filenames = await fs.readdir(targetPath);
    const promises = filenames.map(async (n) => File.getSize(path.join(targetPath, n)));
    const sizes: number[] = await Promise.all(promises);

    return stat.size + CustomMath.sum(sizes);
  }

  static displayBytes(bytes: number, base: DiskBaseSize = 1024) {
    assert(bytes >= 0);

    if (bytes === 0) {
      return `0B`;
    }

    const idx = Math.trunc(Math.log(bytes) / Math.log(base));
    const value = bytes / Math.pow(base, idx);
    const units = File.getDiskUnits(base);

    assert(0 <= idx && idx < units.length);

    return `${value.toFixed(2)}${units[idx]}`;
  }

  private static getDiskUnits(base: DiskBaseSize) {
    if (base === 1000) {
      return ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (base === 1024) {
      return ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    }

    throw new Error(base);
  }

  static async read(path: string) {
    return fs.readFile(path, 'utf8');
  }

  static async write(filePath: string, content: string, recursive = false) {
    if (recursive) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }

    await fs.writeFile(filePath, content);
  }

  static async copy(sourcePath: string, targetPath: string, recursive = false) {
    if (recursive) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
    }

    await fs.copyFile(sourcePath, targetPath);
  }

  static async readOrCreate(path: string, defaultContent: string) {
    if (!(await File.exists(path))) {
      await File.write(path, defaultContent, true);
    }

    return File.read(path);
  }

  static async writeIfChanged(filePath: string, content: string, recursive = false) {
    const exists = await File.exists(filePath);
    const oldContent = exists ? await File.read(filePath) : undefined;

    if (oldContent === content) {
      return;
    }

    await File.write(filePath, content, recursive);
  }

  static commonDir(paths: readonly string[]) {
    const dirs = paths.map((p) => path.dirname(p).split(path.sep));
    const [first = [], ...rest] = dirs;

    let depth = first.length;

    for (const dir of rest) {
      let matched = 0;

      while (matched < depth && matched < dir.length && first[matched] === dir[matched]) {
        matched += 1;
      }

      depth = matched;
    }

    return first.slice(0, depth).join(path.sep) || path.sep;
  }
}
