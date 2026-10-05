import { CliExitError } from '@syscript/cli';
import { assert } from '@syscript/share/util';
import nodePath from 'path';
import * as ast from 'typescript7/unstable/ast';
import { ModuleDetectionKind } from 'typescript7/unstable/proto';
import * as ts from 'typescript7/unstable/sync';
import { EmitOnly } from 'typescript7/unstable/sync';
import { logSuccess, logWarn } from '~/log.js';
import { File } from '~/util/file.js';
import { AbsolutePath, Path, RealPath } from '~/util/path.js';

type TsParserInitOption = {
  tsserverPath: RealPath;
  preludePath: RealPath;
  entryPath: RealPath;
  configFilePath?: RealPath;
};

type TsParserContext = {
  cwd: RealPath;
  entryPath: RealPath;
  preludePath: RealPath;
  configFileDir?: RealPath;
  configFilePath?: RealPath;
  config?: ts.ParsedCommandLine;
  api: ts.API;
  program: ts.Program;
  checker: ts.Checker;
  tsPathToRealPathMap: ReadonlyMap<ast.RootedFilePath, RealPath>;
  realPathToTsPathsMap: ReadonlyMap<RealPath, readonly ast.RootedFilePath[]>;
};

const overrideTsConfigOption = {
  noLib: true,
  noEmitOnError: true,

  module: ts.ModuleKind.Preserve,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ast.ScriptTarget.ESNext,

  // Stricter Typechecking Options
  noUncheckedIndexedAccess: true,
  // exactOptionalPropertyTypes: true,

  // Style Options
  // noImplicitReturns: true,
  // noImplicitOverride: true,
  // noUnusedLocals: true,
  // noUnusedParameters: true,
  // noFallthroughCasesInSwitch: true,
  // noPropertyAccessFromIndexSignature: true,

  // Recommended Options
  strict: true,
  strictBindCallApply: true,
  strictBuiltinIteratorReturn: true,
  strictFunctionTypes: true,
  strictNullChecks: true,
  strictPropertyInitialization: true,
  // "verbatimModuleSyntax": true,
  isolatedModules: true,
  noUncheckedSideEffectImports: true,
  moduleDetection: ModuleDetectionKind.Force,
  skipLibCheck: true,
} as const satisfies ts.CompilerOptions;

export class TsParser {
  private readonly context: TsParserContext;

  private constructor(context: TsParserContext) {
    this.context = context;
  }

  get api() {
    return this.context.api;
  }

  get program() {
    return this.context.program;
  }

  get checker() {
    return this.context.checker;
  }

  static async init(option: TsParserInitOption) {
    const context = await TsParser.initContext(option);
    const diagnostics = context.program.emitToString(EmitOnly.OnlyDts).diagnostics;

    if (diagnostics.length) {
      context.api.close();
      console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, context.program));
      throw CliExitError.default(`${diagnostics.length} typescript errors with ssc config`);
    }

    return new TsParser(context);
  }

  close() {
    // this.api.close();
  }

  private static async initContext(option: TsParserInitOption) {
    const { tsserverPath, preludePath, entryPath } = option;
    const autoFindConfigFileName = 'tsconfig.json';
    const inputConfigFilePath =
      option.configFilePath
      || (await TsParser.autoFindConfigFile(Path.dirname(entryPath), autoFindConfigFileName));
    const api = new ts.API({ tsserverPath, cwd: Path.dirname(inputConfigFilePath || entryPath) });
    const config =
      inputConfigFilePath ? await TsParser.parseConfigFile(api, inputConfigFilePath) : undefined;
    const configFilePath = config?.configFilePath;
    const targetFilePaths: AbsolutePath[] = [entryPath];

    if (configFilePath) {
      logSuccess(`config: ${configFilePath}`);
    } else {
      logWarn(
        `${autoFindConfigFileName} not found, will use ssc config only and add prelude automatically`,
      );
      targetFilePaths.push(preludePath);
    }

    const program = api.createProgram(targetFilePaths, {
      ...config?.config.options,
      ...overrideTsConfigOption,
    });
    const { checker } = program.getProject();
    const paths = await Promise.all(
      program.getSourceFileNames().map(async (p) => ({
        tsPath: p,
        realPath: await Path.real(Path.absolute({ path: p })),
      })),
    );
    const tsPathToRealPathMap = new Map<ast.RootedFilePath, RealPath>();
    const realPathToTsPathsMap = new Map<RealPath, ast.RootedFilePath[]>();

    const getSourceFile = (path: ast.RootedFilePath) => {
      const sourceFile = program.getSourceFile(path);

      assert(sourceFile, `source file not found: ${path}`);

      return sourceFile;
    };

    paths.forEach((p) => {
      const { tsPath, realPath } = p;
      tsPathToRealPathMap.set(tsPath, realPath);
      const tsPaths = realPathToTsPathsMap.get(realPath) || [];
      realPathToTsPathsMap.set(realPath, [...tsPaths, tsPath]);
    });

    if (configFilePath) {
      const hasPrelude = realPathToTsPathsMap.has(preludePath);

      if (!hasPrelude) {
        const { path } = Path.relative({
          baseDir: Path.dirname(configFilePath),
          path: preludePath,
        });
        const posixPath = path.replaceAll(nodePath.sep, '/');
        const typePath = posixPath.startsWith('../') ? posixPath : `./${posixPath}`;

        throw CliExitError.userError(
          `prelude not found, add '"types": ["${typePath}"]' to ${configFilePath}`,
        );
      }
    }

    const currentCwd = await Path.cwd();

    assert(
      Path.initialCwd === currentCwd,
      `cwd changed from ${Path.initialCwd} to ${currentCwd} while initializing`,
    );

    return {
      cwd: Path.initialCwd,
      entryPath,
      preludePath,
      configFileDir: configFilePath ? Path.dirname(configFilePath) : undefined,
      configFilePath,
      config: config?.config,
      api,
      program,
      checker,
      tsPathToRealPathMap,
      realPathToTsPathsMap,
    } as const satisfies TsParserContext;
  }

  private static async autoFindConfigFile(dir: RealPath, configFileName: string) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const configFilePath = Path.absolute({ baseDir: dir, path: configFileName });

      if (await File.exists(configFilePath)) {
        const configFileRealPath = await Path.real(configFilePath);

        if (!(await File.exists(configFileRealPath, 'directory'))) {
          return configFileRealPath;
        }

        logWarn(`${configFileName} is a directory: ${configFileRealPath}`);
      }

      if (Path.isRoot(dir)) {
        return undefined;
      }

      dir = Path.dirname(dir);
    }
  }

  private static async parseConfigFile(api: ts.API, configFilePath: RealPath) {
    const config = api.parseConfigFile(configFilePath);

    assert(!config.errors.length, JSON.stringify(config.errors));
    assert(config.options.configFilePath, 'config found, but configFilePath is missing');

    const foundConfigFileRealPath = await Path.real(
      Path.absolute({ path: config.options.configFilePath }),
    );

    if (foundConfigFileRealPath !== configFilePath) {
      logWarn(`${foundConfigFileRealPath} does not match expected ${configFilePath}`);
    }

    return { configFilePath: foundConfigFileRealPath, config };
  }

  tsPathToRealPath(path: ast.RootedFilePath) {
    const realPath = this.context.tsPathToRealPathMap.get(path);

    assert(realPath, `real path not found: ${path}`);

    return realPath;
  }

  realPathToTsPaths(path: RealPath) {
    const tsPaths = this.context.realPathToTsPathsMap.get(path);

    assert(tsPaths, `ts path not found: ${path}`);

    return tsPaths;
  }
}
