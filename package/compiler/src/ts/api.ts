// TODO: call linked functions when self hosting
import { CliExitError } from '@syscript/cli';
import { createRequire } from 'module';
import * as ast from 'typescript7/ast';
import { APIMethodInfo } from 'typescript7/proto';
import * as ts from 'typescript7/sync';

type TscAddon = {
  open(cwd: string): void;
  request(method: string, params: Buffer): Buffer;
};

export class ApiClient {
  private readonly addon: TscAddon;

  constructor(option: { addonPath: string; cwd: string }) {
    this.addon = createRequire(import.meta.url)(option.addonPath) as TscAddon;
    this.addon.open(option.cwd);
  }

  request<Method extends keyof APIMethodInfo>(
    method: Method,
    params: APIMethodInfo[Method]['params'],
  ) {
    const response = this.addon.request(method, Buffer.from(JSON.stringify(params)));

    return JSON.parse(response.toString()) as APIMethodInfo[Method]['result'];
  }
}

export class TsApi {
  private readonly api: ts.API;

  constructor(options: ts.APIOptions) {
    this.api = new ts.API(options);
  }

  parseConfigFile(file: ts.DocumentIdentifier) {
    return this.api.parseConfigFile(file);
  }

  createProgram(
    rootFiles: readonly ts.DocumentIdentifier[],
    compilerOptions: ts.RawCompilerOptions,
  ) {
    return new ProgramApi(this.api.createProgram(rootFiles, compilerOptions));
  }

  checkCompileError(program: ProgramApi) {
    const diagnostics = program.emitToString(ts.EmitOnly.OnlyDts).diagnostics;

    if (diagnostics.length) {
      this.close();
      console.error(program.formatDiagnosticsWithColorAndContext(diagnostics));
      throw CliExitError.default(`${diagnostics.length} typescript errors with ssc config`);
    }
  }

  close() {
    this.api.close();
  }
}

export class ProgramApi {
  private readonly program: ts.Program;

  constructor(program: ts.Program) {
    this.program = program;
  }

  getChecker() {
    return new CheckerApi(this.program.getProject().checker);
  }

  getSourceFileNames() {
    return this.program.getSourceFileNames();
  }

  getSourceFile(file: ts.DocumentIdentifier) {
    return this.program.getSourceFile(file);
  }

  getResolvedModuleFromModuleSpecifier(
    moduleSpecifier: ast.StringLiteralLikeNode,
    sourceFile?: ts.DocumentIdentifier,
  ) {
    return this.program.getResolvedModuleFromModuleSpecifier(moduleSpecifier, sourceFile);
  }

  emitToString(emitOnly: ts.EmitOnly) {
    return this.program.emitToString(emitOnly);
  }

  formatDiagnosticsWithColorAndContext(diagnostics: readonly ts.Diagnostic[]) {
    return ts.formatDiagnosticsWithColorAndContext(diagnostics, this.program);
  }
}

export class CheckerApi {
  private readonly checker: ts.Checker;

  constructor(checker: ts.Checker) {
    this.checker = checker;
  }

  getTypeAtLocation(node: ast.Node) {
    return this.checker.getTypeAtLocation(node);
  }

  getSymbolAtLocation(node: ast.Node) {
    return this.checker.getSymbolAtLocation(node);
  }

  getShorthandAssignmentValueSymbol(node: ast.Node) {
    return this.checker.getShorthandAssignmentValueSymbol(node);
  }

  getSymbolOfNode(node: ast.Node) {
    return this.checker.getSymbolOfNode(node);
  }

  getAliasedSymbol(symbol: ts.Symbol) {
    return this.checker.getAliasedSymbol(symbol);
  }

  getSignatureFromDeclaration(node: ast.Node) {
    return this.checker.getSignatureFromDeclaration(node);
  }

  getContextualType(node: ast.Expression) {
    return this.checker.getContextualType(node);
  }

  getTypeOfSymbol(symbol: ts.Symbol) {
    return this.checker.getTypeOfSymbol(symbol);
  }

  isUndefinedSymbol(symbol: ts.Symbol) {
    return this.checker.isUndefinedSymbol(symbol);
  }

  typeToString(type: ts.Type) {
    return this.checker.typeToString(type);
  }

  isArrayType(type: ts.Type) {
    return this.checker.isArrayType(type);
  }

  getPropertiesOfType(type: ts.Type) {
    return this.checker.getPropertiesOfType(type);
  }

  getSignaturesOfType(type: ts.Type, kind: ts.SignatureKind) {
    return this.checker.getSignaturesOfType(type, kind);
  }

  getTypeArguments(type: ts.TypeReference) {
    return this.checker.getTypeArguments(type);
  }
}
