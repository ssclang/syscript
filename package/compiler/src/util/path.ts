import fs from 'fs/promises';
import nodePath from 'path';

export type AbsolutePath = string & { readonly __brand: unique symbol };

export type RealPath = AbsolutePath & { readonly __brand_: unique symbol };

export type RelativePath = {
  readonly baseDir: AbsolutePath;
  readonly path: string;
  readonly absolutePath: AbsolutePath;
} & { readonly __brand: unique symbol };

const initialCwd = await fs.realpath(process.cwd()).then((r) => r as RealPath);

export class Path {
  static readonly initialCwd = initialCwd;

  static async cwd() {
    return fs.realpath(process.cwd()).then((r) => r as RealPath);
  }

  static async moduleDir(meta: ImportMeta) {
    return fs.realpath(meta.dirname).then((r) => r as RealPath);
  }

  static absolute(option: { baseDir?: AbsolutePath; path: string }) {
    const { baseDir = Path.initialCwd, path } = option;
    return nodePath.resolve(baseDir, path) as AbsolutePath;
  }

  static async real(path: AbsolutePath) {
    return fs.realpath(path).then((r) => r as RealPath);
  }

  static relative(option: { baseDir?: AbsolutePath; path: AbsolutePath }) {
    const { baseDir = Path.initialCwd, path } = option;
    return { baseDir, path: nodePath.relative(baseDir, path), absolutePath: path } as RelativePath;
  }

  static dirname<T extends AbsolutePath>(path: T) {
    return nodePath.dirname(path) as T;
  }

  static isRoot(path: AbsolutePath) {
    return nodePath.dirname(path) === path;
  }
}
