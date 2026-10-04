import { CliExitError } from '@syscript/cli';
import { assert, Time } from '@syscript/share/util';
import path from 'path';
import * as ast from 'typescript7/unstable/ast';
import { ModuleDetectionKind } from 'typescript7/unstable/proto';
import * as ts from 'typescript7/unstable/sync';
import { EmitOnly } from 'typescript7/unstable/sync';
import { AppSourceFile, isSymbolFlagMatch, isTypeFlagMatch } from '~/ts/ts-node.js';
import { File } from '~/util/file.js';

type TsParserInitOption = {
  tsserverPath?: string;
  configFilePath?: string;
  filePaths?: readonly string[];
};

type TsParserContext = {
  cwd: string;
  configFileDir?: string;
  configFilePath?: string;
  config?: ts.ParsedCommandLine;
  api: ts.API;
  program: ts.Program;
  checker: ts.Checker;
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
      console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, context.program));
      throw CliExitError.default(`${diagnostics.length} typescript errors`);
    }

    return new TsParser(context);
  }

  close() {
    this.api.close();
  }

  private static async initContext(option: TsParserInitOption) {
    const { tsserverPath, configFilePath, filePaths = [] } = option;
    const api = new ts.API({ tsserverPath });
    const config = configFilePath ? await TsParser.findConfigFile(api, configFilePath) : undefined;
    const resolvedFilePaths: string[] = [];

    config?.fileNames.forEach((f) => resolvedFilePaths.push(f));
    filePaths.forEach((f) => resolvedFilePaths.push(path.resolve(f)));

    const program = api.createProgram(resolvedFilePaths, {
      ...config?.options,
      ...overrideTsConfigOption,
    });
    const { checker } = program.getProject();

    return {
      cwd: process.cwd(),
      configFileDir: configFilePath ? path.dirname(configFilePath) : undefined,
      configFilePath,
      config,
      api,
      program,
      checker,
    } as const satisfies TsParserContext;
  }

  private static async findConfigFile(api: ts.API, configFilePath: string) {
    configFilePath = path.resolve(configFilePath);

    assert(await File.exists(configFilePath), `tsconfig not found: ${configFilePath}`);

    const config = api.parseConfigFile(configFilePath);

    assert(!config.errors.length, JSON.stringify(config.errors));

    return config;
  }

  printContextInfo() {
    const { cwd, configFileDir, configFilePath } = this.context;
    console.log({
      cwd,
      configFileDir,
      configFilePath,
    });
  }
}

export class AppSymbol {
  readonly #sourceSymbol: ts.Symbol;
  readonly #aliasSymbol: ts.Symbol | undefined;
  readonly id: number;
  readonly name: string;
  readonly flags: ts.SymbolFlags;

  constructor(id: number, sourceSymbol: ts.Symbol, aliasSymbol?: ts.Symbol) {
    this.#sourceSymbol = sourceSymbol;
    this.#aliasSymbol = aliasSymbol;
    this.id = id;
    this.name = sourceSymbol.name;
    this.flags = sourceSymbol.flags;
  }

  get sourceSymbol() {
    return this.#sourceSymbol;
  }

  get aliasSymbol() {
    return this.#aliasSymbol;
  }

  display() {
    console.dir(this, { depth: undefined });
  }
}

export class AppType {
  readonly #tsType: ts.Type;
  readonly id: number;
  readonly name: string;
  readonly symbol: AppSymbol | undefined;

  constructor(id: number, name: string, tsType: ts.Type, symbol?: AppSymbol) {
    this.#tsType = tsType;
    this.id = id;
    this.name = name;
    this.symbol = symbol;
  }

  get tsType() {
    return this.#tsType;
  }

  display() {
    console.dir(this, { depth: undefined });
  }
}

export class App {
  readonly #parser: TsParser;
  readonly typeRegistry: TypeRegistry;
  readonly sourceFiles: AppSourceFile[] = [];

  private readonly symbolRegistry = new SymbolRegistry();
  private readonly appSymbolMap = new Map<ts.Symbol, AppSymbol>();
  private readonly typeMap = new Map<ast.Node, ts.Type>();
  private readonly contextualTypeMap = new Map<ast.Node, ts.Type>();
  private readonly symbolMap = new Map<ast.Node, ts.Symbol>();
  private readonly declarationMap = new Map<ts.Symbol, ast.Declaration>();
  private readonly typeSymbolMap = new Map<ts.Type, AppSymbol>();
  private readonly typeAliasSymbolMap = new Map<ts.Type, AppSymbol>();
  private readonly typeNameMap = new Map<ts.Type, string>();

  private constructor(parser: TsParser) {
    this.#parser = parser;
    this.typeRegistry = new TypeRegistry(this);
  }

  static init(parser: TsParser) {
    const app = new App(parser);

    app.prefetch();
    parser.close();

    return app;
  }

  static initV2(parser: TsParser, log: 'log' | 'debug') {
    const app = new App(parser);

    app.prefetchv2(log);
    parser.close();

    return app;
  }

  private get checker() {
    return this.#parser.checker;
  }

  private prefetchv2(log: 'log' | 'debug') {
    const { program } = this.#parser;

    const sourceFilesResult = Time.measure(() => {
      return program.getSourceFileNames().map((f) => {
        const sourceFile = program.getSourceFile(f);
        assert(sourceFile, `source file not found: ${f}`);
        return sourceFile;
      });
    });

    if (log === 'debug') {
      console.debug('Source files result:', Time.displayMeasureResult(sourceFilesResult, 'ms'));
    }
  }

  private prefetch() {
    const { checker } = this;
    const { program } = this.#parser;
    const nodes: ast.Node[] = [];
    const identifiers: ast.Identifier[] = [];
    // 모듈 지정자의 심볼은 대상 모듈이라, 선언을 따라가면 import한 소스 파일이 나온다.
    const moduleSpecifiers: ast.StringLiteral[] = [];
    const numericLiterals: ast.NumericLiteral[] = [];
    const tsSourceFiles = program.getSourceFileNames().map((f) => {
      const sourceFile = program.getSourceFile(f);

      assert(sourceFile, `source file not found: ${f}`);

      return sourceFile;
    });

    const visit = (node: ast.Node) => {
      nodes.push(node);

      if (ast.isIdentifier(node)) {
        identifiers.push(node);
      }

      if (ast.isNumericLiteral(node)) {
        numericLiterals.push(node);
      }

      const specifier = moduleSpecifierOf(node);

      if (specifier) {
        moduleSpecifiers.push(specifier);
      }

      node.forEachChild(visit);
    };

    for (const sourceFile of tsSourceFiles) {
      sourceFile.forEachChild(visit);
    }

    const tsTypes = checker.getTypeAtLocation(nodes);
    // widened type map for literal types
    const widened = new Map<ts.Type, ts.Type>();

    nodes.forEach((node, index) => {
      const tsType = tsTypes[index];

      assert(tsType);

      if (isTypeFlagMatch(tsType, ts.TypeFlags.Literal) && !widened.has(tsType)) {
        widened.set(tsType, checker.getBaseTypeOfLiteralType(tsType));
      }

      this.typeMap.set(node, widened.get(tsType) || tsType);
    });

    const symbolNodes = [...identifiers, ...moduleSpecifiers];
    const tsSymbols = checker.getSymbolAtLocation(symbolNodes);

    symbolNodes.forEach((node, index) => {
      const tsSymbol = tsSymbols[index];

      if (tsSymbol) {
        this.symbolMap.set(node, tsSymbol);
      }
    });

    for (const literal of numericLiterals) {
      const contextual = checker.getContextualType(literal);

      if (contextual) {
        this.contextualTypeMap.set(literal, contextual);
      }
    }

    for (const tsSymbol of new Set(this.symbolMap.values())) {
      this.internSymbol(tsSymbol);
    }

    for (const tsType of new Set([...this.typeMap.values(), ...this.contextualTypeMap.values()])) {
      this.internTsType(tsType);
    }

    // 노드 생성자가 위에서 채운 맵을 읽으므로 마지막에 만든다.
    for (const [idx, sourceFile] of tsSourceFiles.entries()) {
      this.sourceFiles.push(new AppSourceFile(this, sourceFile, idx));
    }
  }

  private internSymbol(tsSymbol: ts.Symbol) {
    const cached = this.appSymbolMap.get(tsSymbol);

    if (cached) {
      return cached;
    }

    const isAlias = isSymbolFlagMatch(tsSymbol, ts.SymbolFlags.Alias);
    const sourceSymbol = isAlias ? this.checker.getAliasedSymbol(tsSymbol) : tsSymbol;
    const aliasSymbol = isAlias ? tsSymbol : undefined;
    const appSymbol = new AppSymbol(
      this.symbolRegistry.getId(sourceSymbol),
      sourceSymbol,
      aliasSymbol,
    );

    this.appSymbolMap.set(tsSymbol, appSymbol);

    const [handle] = sourceSymbol.declarations;
    const declaration = handle?.resolve();

    if (declaration) {
      this.declarationMap.set(sourceSymbol, declaration);
    }

    return appSymbol;
  }

  private internTsType(tsType: ts.Type) {
    if (this.typeNameMap.has(tsType)) {
      return;
    }

    const tsAliasSymbol = tsType.getAliasSymbol();
    const tsSymbol = tsType.getSymbol() ?? tsAliasSymbol;

    if (tsAliasSymbol) {
      this.typeAliasSymbolMap.set(tsType, this.internSymbol(tsAliasSymbol));
    }

    if (tsSymbol) {
      this.typeSymbolMap.set(tsType, this.internSymbol(tsSymbol));
    }

    this.typeNameMap.set(tsType, tsSymbol?.name ?? this.checker.typeToString(tsType));
  }

  tsTypeOf(node: ast.Node) {
    const tsType = this.typeMap.get(node);

    assert(tsType, `type not prefetched: ${node.getText()}`);

    return tsType;
  }

  contextualTsTypeOf(node: ast.Node) {
    return this.contextualTypeMap.get(node);
  }

  symbolOfTsType(tsType: ts.Type) {
    return this.typeSymbolMap.get(tsType);
  }

  aliasSymbolOfTsType(tsType: ts.Type) {
    return this.typeAliasSymbolMap.get(tsType);
  }

  nameOfTsType(tsType: ts.Type) {
    const name = this.typeNameMap.get(tsType);

    assert(name, 'type name not prefetched');

    return name;
  }

  symbolOf(node: ast.Node) {
    const tsSymbol = this.symbolMap.get(node);

    return tsSymbol && this.appSymbolMap.get(tsSymbol);
  }

  declarationOf(symbol: AppSymbol) {
    return this.declarationMap.get(symbol.sourceSymbol);
  }

  declarationAt(node: ast.Node) {
    const symbol = this.symbolOf(node);

    return symbol && this.declarationOf(symbol);
  }

  /** 모듈 지정자가 가리키는 소스 파일. 해석되지 않은 지정자면 없다. */
  sourceFileOfModule(specifier: ast.StringLiteral) {
    const declaration = this.declarationAt(specifier);

    return declaration && ast.isSourceFile(declaration) ?
        this.sourceFiles.find((s) => s.fileName === declaration.fileName)
      : undefined;
  }

  typeOf(node: ast.Node) {
    return this.typeRegistry.resolve(node);
  }

  returnTypeOf(declaration: ast.FunctionDeclaration) {
    return this.typeRegistry.resolveReturn(declaration);
  }
}

export class SymbolRegistry {
  private readonly map = new Map<ts.Symbol, number>();
  private id = 0;

  getId(symbol: ts.Symbol) {
    let id = this.map.get(symbol);

    if (id) {
      return id;
    }

    id = ++this.id;

    this.map.set(symbol, id);

    return id;
  }
}

export class TypeRegistry {
  private readonly typeMap = new Map<AppSymbol | ts.Type, AppType>();
  private readonly nodeMap = new Map<ast.Node, AppType>();
  private id = 0;

  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  resolve(node: ast.Node): AppType | undefined {
    return this.resolveNode(node, new Set());
  }

  resolveReturn(declaration: ast.FunctionDeclaration) {
    return this.returnTypeOf(declaration, new Set());
  }

  intern(tsType: ts.Type) {
    const symbol = this.app.symbolOfTsType(tsType);
    const key = symbol ?? tsType;
    const cached = this.typeMap.get(key);

    if (cached) {
      return cached;
    }

    const appType = new AppType(++this.id, this.app.nameOfTsType(tsType), tsType, symbol);

    this.typeMap.set(key, appType);

    return appType;
  }

  private resolveNode(node: ast.Node, resolving: Set<ast.Node>): AppType | undefined {
    const cached = this.nodeMap.get(node);

    if (cached) {
      return cached;
    }

    if (resolving.has(node)) {
      return undefined;
    }

    resolving.add(node);

    const appType = this.compute(node, resolving);

    resolving.delete(node);

    if (appType) {
      this.nodeMap.set(node, appType);
    }

    return appType;
  }

  private compute(node: ast.Node, resolving: Set<ast.Node>): AppType | undefined {
    const annotation = this.annotationOf(node);

    if (annotation) {
      return this.intern(this.app.tsTypeOf(annotation));
    }

    const tsType = this.app.tsTypeOf(node);

    if (this.app.aliasSymbolOfTsType(tsType) || !isTypeFlagMatch(tsType, ts.TypeFlags.NumberLike)) {
      return this.intern(tsType);
    }

    return this.follow(node, resolving);
  }

  private follow(node: ast.Node, resolving: Set<ast.Node>): AppType | undefined {
    if (ast.isParenthesizedExpression(node)) {
      return this.resolveNode(node.expression, resolving);
    }

    if (ast.isBinaryExpression(node)) {
      return this.resolveNode(node.left, resolving) ?? this.resolveNode(node.right, resolving);
    }

    if (ast.isPrefixUnaryExpression(node) || ast.isPostfixUnaryExpression(node)) {
      return this.resolveNode(node.operand, resolving);
    }

    if (ast.isConditionalExpression(node)) {
      return (
        this.resolveNode(node.whenTrue, resolving) ?? this.resolveNode(node.whenFalse, resolving)
      );
    }

    if (ast.isVariableDeclaration(node) || ast.isParameterDeclaration(node)) {
      return node.initializer ? this.resolveNode(node.initializer, resolving) : undefined;
    }

    if (ast.isFunctionDeclaration(node)) {
      return this.fromReturns(node, resolving);
    }

    if (ast.isNumericLiteral(node)) {
      const contextual = this.app.contextualTsTypeOf(node);

      return contextual && this.app.aliasSymbolOfTsType(contextual) ?
          this.intern(contextual)
        : this.intern(this.app.tsTypeOf(node)); // number literal without type declaration
    }

    if (ast.isCallExpression(node)) {
      return this.fromCall(node, resolving);
    }

    if (ast.isIdentifier(node)) {
      const declaration = this.app.declarationAt(node);

      return declaration ? this.resolveNode(declaration, resolving) : undefined;
    }

    return undefined;
  }

  private fromCall(node: ast.CallExpression, resolving: Set<ast.Node>) {
    const declaration = this.app.declarationAt(node.expression);

    if (!declaration || !ast.isFunctionDeclaration(declaration)) {
      return undefined;
    }

    return this.returnTypeOf(declaration, resolving);
  }

  private returnTypeOf(declaration: ast.FunctionDeclaration, resolving: Set<ast.Node>) {
    return declaration.type ?
        this.intern(this.app.tsTypeOf(declaration.type))
      : this.fromReturns(declaration, resolving);
  }

  private fromReturns(declaration: ast.FunctionDeclaration, resolving: Set<ast.Node>) {
    const { body } = declaration;

    if (!body) {
      return undefined;
    }

    const types = new Set<AppType>();

    const visit = (node: ast.Node) => {
      if (ast.isFunctionLikeDeclaration(node) && node !== declaration) {
        return;
      }

      if (ast.isReturnStatement(node) && node.expression) {
        const appType = this.resolveNode(node.expression, resolving);

        if (appType) {
          types.add(appType);
        }
      }

      node.forEachChild(visit);
    };

    visit(body);

    const [only] = types;

    return types.size === 1 ? only : undefined;
  }

  private annotationOf(node: ast.Node) {
    if (ast.isVariableDeclaration(node)) {
      return node.type;
    }

    if (ast.isParameterDeclaration(node)) {
      return node.type;
    }

    return undefined;
  }
}

/**
 * `import … from`, `export … from`, 리터럴 인자의 `import()`에서 모듈 지정자를 꺼낸다.
 * 정적 분석으로 대상을 정할 수 있는 형태만 다룬다.
 */
export function moduleSpecifierOf(node: ast.Node) {
  if (ast.isImportDeclaration(node) || ast.isExportDeclaration(node)) {
    const { moduleSpecifier } = node;

    return moduleSpecifier && ast.isStringLiteral(moduleSpecifier) ? moduleSpecifier : undefined;
  }

  if (ast.isCallExpression(node) && node.expression.kind === ast.SyntaxKind.ImportKeyword) {
    const [argument] = node.arguments;

    return argument && ast.isStringLiteral(argument) ? argument : undefined;
  }

  return undefined;
}
