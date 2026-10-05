// import { CliExitError } from '@syscript/cli';
// import { assert } from '@syscript/share/util';
// import nodePath from 'path';
// import * as ast from 'typescript7/unstable/ast';
// import { ModuleDetectionKind } from 'typescript7/unstable/proto';
// import * as ts from 'typescript7/unstable/sync';
// import { EmitOnly } from 'typescript7/unstable/sync';
// import { logSuccess, logWarn } from '~/log.js';
// import { File } from '~/util/file.js';
// import { AbsolutePath, Path, RealPath } from '~/util/path.js';

// type TsParserInitOption = {
//   tsserverPath?: string;
//   entryPath: RealPath;
//   configFilePath?: RealPath;
//   preludePath: RealPath;

//   tsconfigFileName?: string;
// };

// type TsParserContext = {
//   cwd: RealPath;
//   configFileDir?: RealPath;
//   configFilePath?: RealPath;
//   config?: ts.ParsedCommandLine;
//   api: ts.API;
//   program: ts.Program;
//   checker: ts.Checker;
// };

// const overrideTsConfigOption = {
//   noLib: true,
//   noEmitOnError: true,

//   module: ts.ModuleKind.Preserve,
//   moduleResolution: ts.ModuleResolutionKind.Bundler,
//   target: ast.ScriptTarget.ESNext,

//   // Stricter Typechecking Options
//   noUncheckedIndexedAccess: true,
//   // exactOptionalPropertyTypes: true,

//   // Style Options
//   // noImplicitReturns: true,
//   // noImplicitOverride: true,
//   // noUnusedLocals: true,
//   // noUnusedParameters: true,
//   // noFallthroughCasesInSwitch: true,
//   // noPropertyAccessFromIndexSignature: true,

//   // Recommended Options
//   strict: true,
//   strictBindCallApply: true,
//   strictBuiltinIteratorReturn: true,
//   strictFunctionTypes: true,
//   strictNullChecks: true,
//   strictPropertyInitialization: true,
//   // "verbatimModuleSyntax": true,
//   isolatedModules: true,
//   noUncheckedSideEffectImports: true,
//   moduleDetection: ModuleDetectionKind.Force,
//   skipLibCheck: true,
// } as const satisfies ts.CompilerOptions;

// export class TsParser {
//   private readonly context: TsParserContext;

//   private constructor(context: TsParserContext) {
//     this.context = context;
//   }

//   get api() {
//     return this.context.api;
//   }

//   get program() {
//     return this.context.program;
//   }

//   get checker() {
//     return this.context.checker;
//   }

//   static async init(option: TsParserInitOption) {
//     const i3: i32 = 5;
//     const context = await TsParser.initContext(option);
//     const diagnostics = context.program.emitToString(EmitOnly.OnlyDts).diagnostics;

//     if (diagnostics.length) {
//       context.api.close();
//       console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, context.program));
//       throw CliExitError.default(`${diagnostics.length} typescript errors with ssc config`);
//     }

//     return new TsParser(context);
//   }

//   close() {
//     this.api.close();
//   }

//   private static async initContext(option: TsParserInitOption) {
//     const {
//       tsserverPath,
//       entryPath,
//       configFilePath: inputConfigFilePath,
//       preludePath,
//       tsconfigFileName = 'tsconfig.json',
//     } = option;
//     const api = new ts.API({ tsserverPath });
//     const config =
//       inputConfigFilePath ?
//         await TsParser.findConfigFile(api, inputConfigFilePath)
//       : await TsParser.autoFindConfigFile(api, Path.dirname(entryPath), tsconfigFileName);
//     const configFilePath = config?.configFilePath;
//     const targetFilePaths: AbsolutePath[] = [entryPath];

//     if (configFilePath) {
//       logSuccess(`config: ${configFilePath}`);
//     } else {
//       logWarn(
//         `${tsconfigFileName} not found, will use ssc config only and add prelude automatically`,
//       );
//       targetFilePaths.push(preludePath);
//     }

//     const program = api.createProgram(targetFilePaths, {
//       ...config?.config.options,
//       ...overrideTsConfigOption,
//     });
//     const { checker } = program.getProject();

//     if (configFilePath) {
//       const sourceFileNames = program.getSourceFileNames();
//       const hasPrelude =
//         sourceFileNames.some((p) => Path.absolute({ path: p }) === preludePath)
//         || (
//           await Promise.all(sourceFileNames.map(async (p) => Path.real(Path.absolute({ path: p }))))
//         ).includes(preludePath);

//       if (!hasPrelude) {
//         const { path } = Path.relative({
//           baseDir: Path.dirname(configFilePath),
//           path: preludePath,
//         });
//         const posixPath = path.replaceAll(nodePath.sep, '/');
//         const typePath = posixPath.startsWith('../') ? posixPath : `./${posixPath}`;

//         throw CliExitError.userError(
//           `prelude not found, add '"types": ["${typePath}"]' to ${configFilePath}`,
//         );
//       }
//     }

//     const currentCwd = await Path.cwd();

//     assert(
//       Path.initialCwd === currentCwd,
//       `cwd changed from ${Path.initialCwd} to ${currentCwd} while initializing`,
//     );

//     return {
//       cwd: Path.initialCwd,
//       configFileDir: configFilePath ? Path.dirname(configFilePath) : undefined,
//       configFilePath,
//       config: config?.config,
//       api,
//       program,
//       checker,
//     } as const satisfies TsParserContext;
//   }

//   private static async autoFindConfigFile(api: ts.API, dir: RealPath, configFileName: string) {
//     // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//     while (true) {
//       const configFilePath = Path.absolute({ baseDir: dir, path: configFileName });

//       if (await File.exists(configFilePath)) {
//         const configFileRealPath = await Path.real(configFilePath);

//         if (!(await File.exists(configFileRealPath, 'directory'))) {
//           return TsParser.findConfigFile(api, configFileRealPath);
//         }

//         logWarn(`${configFileName} is a directory: ${configFileRealPath}`);
//       }

//       if (Path.isRoot(dir)) {
//         return undefined;
//       }

//       dir = Path.dirname(dir);
//     }
//   }

//   private static async findConfigFile(api: ts.API, configFilePath: RealPath) {
//     const config = api.parseConfigFile(configFilePath);

//     assert(!config.errors.length, JSON.stringify(config.errors));
//     assert(config.options.configFilePath, 'config found, but configFilePath is missing');

//     const foundConfigFileRealPath = await Path.real(
//       Path.absolute({ path: config.options.configFilePath }),
//     );

//     if (foundConfigFileRealPath !== configFilePath) {
//       logWarn(`${foundConfigFileRealPath} does not match expected ${configFilePath}`);
//     }

//     return { configFilePath: foundConfigFileRealPath, config };
//   }

//   printContextInfo() {
//     const { cwd, configFileDir, configFilePath } = this.context;
//     console.log({
//       cwd,
//       configFileDir,
//       configFilePath,
//     });
//   }
// }
