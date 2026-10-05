import * as ast from 'typescript7/unstable/ast';
import * as ts from 'typescript7/unstable/sync';
import { AppSourceFile } from '~/ts/ts-node.js';
import { TsParser } from '~/ts/ts-parserv2.js';
import { RealPath } from '~/util/path.js';

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
  private readonly log: 'log' | 'debug';
  readonly parser: TsParser;
  private readonly sourceFileMap = new Map<RealPath, AppSourceFile>();
  private sourceFileCounter = 0;

  readonly preludeSourceFile: AppSourceFile;
  readonly entrySourceFile: AppSourceFile;

  // private readonly symbolRegistry = new SymbolRegistry();
  // private readonly appSymbolMap = new Map<ts.Symbol, AppSymbol>();
  // private readonly typeMap = new Map<ast.Node, ts.Type>();
  // private readonly contextualTypeMap = new Map<ast.Node, ts.Type>();
  // private readonly symbolMap = new Map<ast.Node, ts.Symbol>();
  // private readonly declarationMap = new Map<ts.Symbol, ast.Declaration>();
  // private readonly typeSymbolMap = new Map<ts.Type, AppSymbol>();
  // private readonly typeAliasSymbolMap = new Map<ts.Type, AppSymbol>();
  // private readonly typeNameMap = new Map<ts.Type, string>();

  private constructor(log: App['log'], parser: TsParser) {
    this.parser = parser;
    this.log = log;

    this.preludeSourceFile = this.loadSourceFile(parser.getSourceFile(parser.preludePath));
    this.entrySourceFile = this.loadSourceFile(parser.getSourceFile(parser.entryPath));

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.log) {
      //
    }
  }

  static init(log: App['log'], parser: TsParser) {
    return new App(log, parser);
  }

  get api() {
    return this.parser.api;
  }

  get program() {
    return this.parser.program;
  }

  get checker() {
    return this.parser.checker;
  }

  get sourceFiles() {
    return this.sourceFileMap.values().toArray();
  }

  loadSourceFile(tsSourceFile: ast.SourceFile) {
    const realPath = this.parser.tsPathToRealPath(tsSourceFile.fileName);
    const cache = this.sourceFileMap.get(realPath);

    if (cache) {
      return cache;
    }

    const sourceFile = new AppSourceFile(this, tsSourceFile, this.sourceFileCounter++, realPath);

    this.sourceFileMap.set(realPath, sourceFile);

    return sourceFile;
  }

  // private internSymbol(tsSymbol: ts.Symbol) {
  //   const cached = this.appSymbolMap.get(tsSymbol);

  //   if (cached) {
  //     return cached;
  //   }

  //   const isAlias = isSymbolFlagMatch(tsSymbol, ts.SymbolFlags.Alias);
  //   const sourceSymbol = isAlias ? this.checker.getAliasedSymbol(tsSymbol) : tsSymbol;
  //   const aliasSymbol = isAlias ? tsSymbol : undefined;
  //   const appSymbol = new AppSymbol(
  //     this.symbolRegistry.getId(sourceSymbol),
  //     sourceSymbol,
  //     aliasSymbol,
  //   );

  //   this.appSymbolMap.set(tsSymbol, appSymbol);

  //   const [handle] = sourceSymbol.declarations;
  //   const declaration = handle?.resolve();

  //   if (declaration) {
  //     this.declarationMap.set(sourceSymbol, declaration);
  //   }

  //   return appSymbol;
  // }

  // private internTsType(tsType: ts.Type) {
  //   if (this.typeNameMap.has(tsType)) {
  //     return;
  //   }

  //   const tsAliasSymbol = tsType.getAliasSymbol();
  //   const tsSymbol = tsType.getSymbol() ?? tsAliasSymbol;

  //   if (tsAliasSymbol) {
  //     this.typeAliasSymbolMap.set(tsType, this.internSymbol(tsAliasSymbol));
  //   }

  //   if (tsSymbol) {
  //     this.typeSymbolMap.set(tsType, this.internSymbol(tsSymbol));
  //   }

  //   this.typeNameMap.set(tsType, tsSymbol?.name ?? this.checker.typeToString(tsType));
  // }

  // tsTypeOf(node: ast.Node) {
  //   const tsType = this.typeMap.get(node);

  //   assert(tsType, `type not prefetched: ${node.getText()}`);

  //   return tsType;
  // }

  // contextualTsTypeOf(node: ast.Node) {
  //   return this.contextualTypeMap.get(node);
  // }

  // symbolOfTsType(tsType: ts.Type) {
  //   return this.typeSymbolMap.get(tsType);
  // }

  // aliasSymbolOfTsType(tsType: ts.Type) {
  //   return this.typeAliasSymbolMap.get(tsType);
  // }

  // nameOfTsType(tsType: ts.Type) {
  //   const name = this.typeNameMap.get(tsType);

  //   assert(name, 'type name not prefetched');

  //   return name;
  // }

  // symbolOf(node: ast.Node) {
  //   const tsSymbol = this.symbolMap.get(node);

  //   return tsSymbol && this.appSymbolMap.get(tsSymbol);
  // }

  // declarationOf(symbol: AppSymbol) {
  //   return this.declarationMap.get(symbol.sourceSymbol);
  // }

  // declarationAt(node: ast.Node) {
  //   const symbol = this.symbolOf(node);

  //   return symbol && this.declarationOf(symbol);
  // }

  // /** 모듈 지정자가 가리키는 소스 파일. 해석되지 않은 지정자면 없다. */
  // sourceFileOfModule(specifier: ast.StringLiteral) {
  //   const declaration = this.declarationAt(specifier);

  //   return declaration && ast.isSourceFile(declaration) ?
  //       this.sourceFiles.find((s) => s.fileName === declaration.fileName)
  //     : undefined;
  // }

  // typeOf(node: ast.Node) {
  //   return this.typeRegistry.resolve(node);
  // }

  // returnTypeOf(declaration: ast.FunctionDeclaration) {
  //   return this.typeRegistry.resolveReturn(declaration);
  // }
}

// export class SymbolRegistry {
//   private readonly map = new Map<ts.Symbol, number>();
//   private id = 0;

//   getId(symbol: ts.Symbol) {
//     let id = this.map.get(symbol);

//     if (id) {
//       return id;
//     }

//     id = ++this.id;

//     this.map.set(symbol, id);

//     return id;
//   }
// }

// export class TypeRegistry {
//   private readonly typeMap = new Map<AppSymbol | ts.Type, AppType>();
//   private readonly nodeMap = new Map<ast.Node, AppType>();
//   private id = 0;

//   private readonly app: App;

//   constructor(app: App) {
//     this.app = app;
//   }

//   resolve(node: ast.Node): AppType | undefined {
//     return this.resolveNode(node, new Set());
//   }

//   resolveReturn(declaration: ast.FunctionDeclaration) {
//     return this.returnTypeOf(declaration, new Set());
//   }

//   intern(tsType: ts.Type) {
//     const symbol = this.app.symbolOfTsType(tsType);
//     const key = symbol ?? tsType;
//     const cached = this.typeMap.get(key);

//     if (cached) {
//       return cached;
//     }

//     const appType = new AppType(++this.id, this.app.nameOfTsType(tsType), tsType, symbol);

//     this.typeMap.set(key, appType);

//     return appType;
//   }

//   private resolveNode(node: ast.Node, resolving: Set<ast.Node>): AppType | undefined {
//     const cached = this.nodeMap.get(node);

//     if (cached) {
//       return cached;
//     }

//     if (resolving.has(node)) {
//       return undefined;
//     }

//     resolving.add(node);

//     const appType = this.compute(node, resolving);

//     resolving.delete(node);

//     if (appType) {
//       this.nodeMap.set(node, appType);
//     }

//     return appType;
//   }

//   private compute(node: ast.Node, resolving: Set<ast.Node>): AppType | undefined {
//     const annotation = this.annotationOf(node);

//     if (annotation) {
//       return this.intern(this.app.tsTypeOf(annotation));
//     }

//     const tsType = this.app.tsTypeOf(node);

//     if (this.app.aliasSymbolOfTsType(tsType) || !isTypeFlagMatch(tsType, ts.TypeFlags.NumberLike)) {
//       return this.intern(tsType);
//     }

//     return this.follow(node, resolving);
//   }

//   private follow(node: ast.Node, resolving: Set<ast.Node>): AppType | undefined {
//     if (ast.isParenthesizedExpression(node)) {
//       return this.resolveNode(node.expression, resolving);
//     }

//     if (ast.isBinaryExpression(node)) {
//       return this.resolveNode(node.left, resolving) ?? this.resolveNode(node.right, resolving);
//     }

//     if (ast.isPrefixUnaryExpression(node) || ast.isPostfixUnaryExpression(node)) {
//       return this.resolveNode(node.operand, resolving);
//     }

//     if (ast.isConditionalExpression(node)) {
//       return (
//         this.resolveNode(node.whenTrue, resolving) ?? this.resolveNode(node.whenFalse, resolving)
//       );
//     }

//     if (ast.isVariableDeclaration(node) || ast.isParameterDeclaration(node)) {
//       return node.initializer ? this.resolveNode(node.initializer, resolving) : undefined;
//     }

//     if (ast.isFunctionDeclaration(node)) {
//       return this.fromReturns(node, resolving);
//     }

//     if (ast.isNumericLiteral(node)) {
//       const contextual = this.app.contextualTsTypeOf(node);

//       return contextual && this.app.aliasSymbolOfTsType(contextual) ?
//           this.intern(contextual)
//         : this.intern(this.app.tsTypeOf(node)); // number literal without type declaration
//     }

//     if (ast.isCallExpression(node)) {
//       return this.fromCall(node, resolving);
//     }

//     if (ast.isIdentifier(node)) {
//       const declaration = this.app.declarationAt(node);

//       return declaration ? this.resolveNode(declaration, resolving) : undefined;
//     }

//     return undefined;
//   }

//   private fromCall(node: ast.CallExpression, resolving: Set<ast.Node>) {
//     const declaration = this.app.declarationAt(node.expression);

//     if (!declaration || !ast.isFunctionDeclaration(declaration)) {
//       return undefined;
//     }

//     return this.returnTypeOf(declaration, resolving);
//   }

//   private returnTypeOf(declaration: ast.FunctionDeclaration, resolving: Set<ast.Node>) {
//     return declaration.type ?
//         this.intern(this.app.tsTypeOf(declaration.type))
//       : this.fromReturns(declaration, resolving);
//   }

//   private fromReturns(declaration: ast.FunctionDeclaration, resolving: Set<ast.Node>) {
//     const { body } = declaration;

//     if (!body) {
//       return undefined;
//     }

//     const types = new Set<AppType>();

//     const visit = (node: ast.Node) => {
//       if (ast.isFunctionLikeDeclaration(node) && node !== declaration) {
//         return;
//       }

//       if (ast.isReturnStatement(node) && node.expression) {
//         const appType = this.resolveNode(node.expression, resolving);

//         if (appType) {
//           types.add(appType);
//         }
//       }

//       node.forEachChild(visit);
//     };

//     visit(body);

//     const [only] = types;

//     return types.size === 1 ? only : undefined;
//   }

//   private annotationOf(node: ast.Node) {
//     if (ast.isVariableDeclaration(node)) {
//       return node.type;
//     }

//     if (ast.isParameterDeclaration(node)) {
//       return node.type;
//     }

//     return undefined;
//   }
// }

// /**
//  * `import … from`, `export … from`, 리터럴 인자의 `import()`에서 모듈 지정자를 꺼낸다.
//  * 정적 분석으로 대상을 정할 수 있는 형태만 다룬다.
//  */
// export function moduleSpecifierOf(node: ast.Node) {
//   if (ast.isImportDeclaration(node) || ast.isExportDeclaration(node)) {
//     const { moduleSpecifier } = node;

//     return moduleSpecifier && ast.isStringLiteral(moduleSpecifier) ? moduleSpecifier : undefined;
//   }

//   if (ast.isCallExpression(node) && node.expression.kind === ast.SyntaxKind.ImportKeyword) {
//     const [argument] = node.arguments;

//     return argument && ast.isStringLiteral(argument) ? argument : undefined;
//   }

//   return undefined;
// }
