import path from 'path';

declare const _sscTsserverPath: string | undefined;

declare const _sscPreludeDir: string | undefined;

export class PathResolver {
  static tsServerPath() {
    return typeof _sscTsserverPath === 'string' ?
        path.join(import.meta.dirname, _sscTsserverPath)
      : path.join(import.meta.dirname, '../../../../../ssclang/TypeScript/built/local/tsc');
  }

  static tscAddonPath() {
    return path.join(import.meta.dirname, '../../../../../ssclang/TypeScript/built/local/tsc.node');
  }

  static preludeDir() {
    return typeof _sscPreludeDir === 'string' ?
        path.join(import.meta.dirname, _sscPreludeDir)
      : path.join(import.meta.dirname, '../../../../prelude/');
  }

  static preludeDtsPath() {
    return path.join(PathResolver.preludeDir(), 'prelude.d.ts');
  }

  static preludeCppmPath() {
    return path.join(PathResolver.preludeDir(), 'prelude.cppm');
  }

  private static llvmDir() {
    return path.join(import.meta.dirname, '../../../../../../tool/llvm');
  }

  private static llvmBinDir() {
    return path.join(PathResolver.llvmDir(), 'bin');
  }

  private static llvmLibDir() {
    return path.join(PathResolver.llvmDir(), 'lib');
  }

  private static llvmShareDir() {
    return path.join(PathResolver.llvmDir(), 'share');
  }

  private static llvmPlatformLibDir() {
    return path.join(PathResolver.llvmLibDir(), 'x86_64-unknown-linux-gnu');
  }

  static clangPath() {
    return path.join(PathResolver.llvmBinDir(), 'clang++');
  }

  static stdCppmPath() {
    return path.join(PathResolver.llvmShareDir(), 'libc++', 'v1', 'std.cppm');
  }

  static libcxxPath() {
    return path.join(PathResolver.llvmPlatformLibDir(), 'libc++.a');
  }

  static libcxxabiPath() {
    return path.join(PathResolver.llvmPlatformLibDir(), 'libc++abi.a');
  }

  static libunwindPath() {
    return path.join(PathResolver.llvmPlatformLibDir(), 'libunwind.a');
  }
}
