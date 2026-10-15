import path from 'path';

declare const _sscTsserverPath: string | undefined;

declare const _sscPreludeDir: string | undefined;

export class PathResolver {
  static tsServerPath() {
    return typeof _sscTsserverPath === 'string' ?
        path.join(import.meta.dirname, _sscTsserverPath)
      : path.join(import.meta.dirname, '../../../../../ssclang/TypeScript/built/local/tsc');
  }

  static preludeDir() {
    return typeof _sscPreludeDir === 'string' ?
        path.join(import.meta.dirname, _sscPreludeDir)
      : path.join(import.meta.dirname, '../../../../prelude/');
  }

  static preludePath() {
    return path.join(PathResolver.preludeDir(), 'prelude.d.ts');
  }

  static tscAddonPath() {
    return path.join(import.meta.dirname, '../../../../../ssclang/TypeScript/built/local/tsc.node');
  }
}
