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

  static llvmBinDir() {
    return path.join(import.meta.dirname, '../../../../../../tool/llvm/bin');
  }

  static llvmLibDir() {
    return path.join(import.meta.dirname, '../../../../../../tool/llvm/lib');
  }

  static clangPath() {
    return path.join(PathResolver.llvmBinDir(), 'clang++');
  }

  static libcxxabiPath() {
    return path.join(PathResolver.llvmLibDir(), 'x86_64-unknown-linux-gnu', 'libc++abi.a');
  }

  static libunwindPath() {
    return path.join(PathResolver.llvmLibDir(), 'x86_64-unknown-linux-gnu', 'libunwind.a');
  }
}
