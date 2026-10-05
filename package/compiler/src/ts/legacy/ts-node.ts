// import { assert } from '@syscript/share/util';
// import BigNumber from 'bignumber.js';
// import path from 'path';
// import * as ast from 'typescript7/unstable/ast';
// import * as ts from 'typescript7/unstable/sync';
// import { printLine } from '~/log.js';
// import { App, AppSymbol, AppType, moduleSpecifierOf } from '~/ts/ts-parser.js';
// import { assertExpectedNode } from '~/util/assert.js';

// // region abstract

// export abstract class AbstractNode<T extends ast.Node> {
//   readonly #app: App;
//   readonly #tsNode: T;

//   constructor(app: App, tsNode: T) {
//     this.#app = app;
//     this.#tsNode = tsNode;
//   }

//   get app() {
//     return this.#app;
//   }

//   get tsNode() {
//     return this.#tsNode;
//   }

//   getSourceFile() {
//     return this.#tsNode.getSourceFile();
//   }

//   getText() {
//     return this.tsNode.getText();
//   }

//   /** 에러 메시지 앞에 붙이는 `파일:줄:칸`. 편집기가 바로 잡아낸다. */
//   location() {
//     const sourceFile = this.getSourceFile();
//     const position = this.tsNode.getStart(sourceFile);
//     const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);

//     return `${sourceFile.fileName}:${line + 1}:${character + 1}`;
//   }

//   print() {
//     console.dir(this, { depth: undefined });
//   }
// }

// export abstract class AbstractStatement<
//   T extends ast.Statement = ast.Statement,
// > extends AbstractNode<T> {
//   static of(app: App, tsNode: ast.Statement) {
//     if (tsNode.getSourceFile().isDeclarationFile) {
//       return new NodeAmbientDeclaration(app, tsNode);
//     }

//     // 소스 파일의 `declare function`은 전방 선언으로 처리
//     if (isNodeFlagMatch(tsNode, ast.NodeFlags.Ambient)) {
//       if (ast.isFunctionDeclaration(tsNode)) {
//         return new NodeFunctionDeclaration(app, tsNode);
//       }

//       // TODO: conflict test
//       // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//       // @ts-expect-error
//       // eslint-disable-next-line no-constant-condition, @typescript-eslint/no-unnecessary-condition
//       if ('test') {
//         throw new Error(`not implemented ambient statement: ${tsNode.getText()}`);
//       }

//       if (ast.isTypeAliasDeclaration(tsNode)) {
//         return new NodeTypeAliasDeclaration(app, tsNode);
//       }

//       if (ast.isInterfaceDeclaration(tsNode)) {
//         return new NodeInterfaceDeclaration(app, tsNode);
//       }

//       if (ast.isClassDeclaration(tsNode)) {
//         return new NodeClassDeclaration(app, tsNode);
//       }

//       throw new Error(`not implemented ambient statement: ${tsNode.getText()}`);
//     }

//     if (ast.isFunctionDeclaration(tsNode)) {
//       return new NodeFunctionDeclaration(app, tsNode);
//     }

//     if (ast.isBlock(tsNode)) {
//       return new NodeBlock(app, tsNode);
//     }

//     if (ast.isReturnStatement(tsNode)) {
//       return new NodeReturnStatement(app, tsNode);
//     }

//     if (ast.isImportDeclaration(tsNode)) {
//       return new NodeImportDeclaration(app, tsNode);
//     }

//     if (ast.isExpressionStatement(tsNode)) {
//       return new NodeExpressionStatement(app, tsNode);
//     }

//     if (ast.isVariableStatement(tsNode)) {
//       return new NodeVariableStatement(app, tsNode);
//     }

//     if (ast.isIfStatement(tsNode)) {
//       return new NodeIfStatement(app, tsNode);
//     }

//     if (ast.isForStatement(tsNode)) {
//       return new NodeForStatement(app, tsNode);
//     }

//     if (ast.isWhileStatement(tsNode)) {
//       return new NodeWhileStatement(app, tsNode);
//     }

//     if (ast.isBreakStatement(tsNode)) {
//       return new NodeBreakStatement(app, tsNode);
//     }

//     if (ast.isContinueStatement(tsNode)) {
//       return new NodeContinueStatement(app, tsNode);
//     }

//     throw new Error(`not implemented statement: ${tsNode.getText()}`);
//   }
// }

// export abstract class AbstractExpression<
//   T extends ast.Expression = ast.Expression,
// > extends AbstractNode<T> {
//   static of(app: App, tsNode?: ast.Expression) {
//     assert(tsNode);

//     if (ast.isPrefixUnaryExpression(tsNode)) {
//       return new NodePrefixUnaryExpression(app, tsNode);
//     }

//     if (ast.isPostfixUnaryExpression(tsNode)) {
//       return new NodePostfixUnaryExpression(app, tsNode);
//     }

//     if (ast.isBinaryExpression(tsNode)) {
//       return new NodeBinaryExpression(app, tsNode);
//     }

//     if (ast.isCallExpression(tsNode)) {
//       return new NodeCallExpression(app, tsNode);
//     }

//     if (ast.isIdentifier(tsNode)) {
//       return new NodeIdentifier(app, tsNode);
//     }

//     if (ast.isNumericLiteral(tsNode)) {
//       return new NodeNumericLiteral(app, tsNode);
//     }

//     if (tsNode.kind === ast.SyntaxKind.TrueKeyword || tsNode.kind === ast.SyntaxKind.FalseKeyword) {
//       return new NodeBooleanLiteral(app, tsNode);
//     }

//     if (ast.isParenthesizedExpression(tsNode)) {
//       return new NodeParenthesizedExpression(app, tsNode);
//     }

//     throw new Error(`not implemented expression: ${tsNode.getText()}`);
//   }
// }

// // region statement

// export class NodeFunctionDeclaration extends AbstractStatement<ast.FunctionDeclaration> {
//   readonly isExported: boolean;
//   readonly isDeclared: boolean;
//   readonly identifier: NodeIdentifier;
//   readonly parameters: NodeParameterDeclaration[];
//   readonly returnType: AppType;
//   readonly block: NodeBlock | undefined;

//   constructor(app: App, tsNode: ast.FunctionDeclaration) {
//     super(app, tsNode);
//     this.isExported = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Export);
//     this.isDeclared = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Ambient);
//     this.identifier = new NodeIdentifier(app, this.tsNode.name);
//     this.parameters = this.tsNode.parameters.map((p) => new NodeParameterDeclaration(app, p));

//     const returnType = app.returnTypeOf(this.tsNode);

//     assert(returnType, `returnType not found: ${this.identifier.text}`);

//     this.returnType = returnType;
//     this.block = this.tsNode.body && new NodeBlock(app, this.tsNode.body);
//   }
// }

// export class NodeReturnStatement extends AbstractStatement<ast.ReturnStatement> {
//   readonly expression: AbstractNode<ast.Expression>;

//   constructor(app: App, tsNode: ast.ReturnStatement) {
//     super(app, tsNode);
//     this.expression = AbstractExpression.of(app, this.tsNode.expression);
//   }
// }

// export class NodeBlock extends AbstractStatement<ast.Block> {
//   readonly statements: AbstractStatement[];

//   constructor(app: App, tsNode?: ast.Block) {
//     assert(tsNode);
//     super(app, tsNode);
//     this.statements = this.tsNode.statements.map((s) => AbstractStatement.of(app, s));
//   }
// }

// export class NodeImportDeclaration extends AbstractStatement<ast.ImportDeclaration> {
//   readonly moduleSpecifier: NodeStringLiteral;
//   readonly identifiers: NodeIdentifier[];

//   constructor(app: App, tsNode: ast.ImportDeclaration) {
//     super(app, tsNode);
//     const { importClause, moduleSpecifier } = this.tsNode;

//     assertExpectedNode(moduleSpecifier, ast.isStringLiteral);

//     this.moduleSpecifier = new NodeStringLiteral(app, moduleSpecifier);

//     // `import './x.js'`는 가져오는 이름 없이 초기화만 일으킨다.
//     if (!importClause) {
//       this.identifiers = [];
//       return;
//     }

//     const { namedBindings } = importClause;

//     assert(namedBindings, `not namedBindings: ${importClause.getText()}`);
//     assertExpectedNode(namedBindings, ast.isNamedImports);

//     this.identifiers = namedBindings.elements.map((i) => new NodeIdentifier(app, i.name));
//   }
// }

// export class NodeExpressionStatement extends AbstractStatement<ast.ExpressionStatement> {
//   readonly expression: AbstractExpression;

//   constructor(app: App, tsNode: ast.ExpressionStatement) {
//     super(app, tsNode);
//     this.expression = AbstractExpression.of(app, this.tsNode.expression);
//   }
// }

// export class NodeVariableStatement extends AbstractStatement<ast.VariableStatement> {
//   readonly isExported: boolean;
//   readonly isDeclare: boolean;
//   readonly declarations: NodeVariableDeclaration[];

//   constructor(app: App, tsNode: ast.VariableStatement) {
//     super(app, tsNode);
//     this.isExported = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Export);
//     this.isDeclare = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Ambient);
//     this.declarations = this.tsNode.declarationList.declarations.map(
//       (v) => new NodeVariableDeclaration(app, v, this.isExported),
//     );
//   }
// }

// export class NodeIfStatement extends AbstractStatement<ast.IfStatement> {
//   readonly expression: AbstractExpression;
//   readonly block: NodeBlock;
//   readonly elseStatement: NodeBlock | NodeIfStatement | undefined;

//   constructor(app: App, tsNode: ast.IfStatement) {
//     super(app, tsNode);

//     const { expression, thenStatement, elseStatement } = this.tsNode;

//     this.expression = AbstractExpression.of(app, expression);

//     assertExpectedNode(thenStatement, ast.isBlock);

//     this.block = new NodeBlock(app, thenStatement);

//     if (!elseStatement) {
//       return;
//     }

//     if (ast.isIfStatement(elseStatement)) {
//       this.elseStatement = new NodeIfStatement(app, elseStatement);
//       return;
//     }

//     if (ast.isBlock(elseStatement)) {
//       this.elseStatement = new NodeBlock(app, elseStatement);
//       return;
//     }

//     throw new Error(`not implemented: ${elseStatement.getText()}`);
//   }
// }

// export class NodeForStatement extends AbstractStatement<ast.ForStatement> {
//   readonly declarations: NodeVariableDeclaration[];
//   readonly condition: AbstractExpression;
//   readonly incrementor: AbstractExpression;
//   readonly block: NodeBlock;

//   constructor(app: App, tsNode: ast.ForStatement) {
//     super(app, tsNode);

//     const { initializer, condition, incrementor, statement } = this.tsNode;

//     assertExpectedNode(initializer, ast.isVariableDeclarationList);

//     this.declarations = initializer.declarations.map((d) => new NodeVariableDeclaration(app, d));
//     this.condition = AbstractExpression.of(app, condition);
//     this.incrementor = AbstractExpression.of(app, incrementor);

//     assertExpectedNode(statement, ast.isBlock);

//     this.block = new NodeBlock(app, statement);
//   }
// }

// export class NodeWhileStatement extends AbstractStatement<ast.WhileStatement> {
//   readonly expression: AbstractExpression;
//   readonly block: NodeBlock;

//   constructor(app: App, tsNode: ast.WhileStatement) {
//     super(app, tsNode);

//     const { expression, statement } = this.tsNode;

//     this.expression = AbstractExpression.of(app, expression);

//     assertExpectedNode(statement, ast.isBlock);

//     this.block = new NodeBlock(app, statement);
//   }
// }

// /**
//  * 레이블은 C에 대응이 없다. `goto`로 풀 수는 있지만 레이블 위치를 따로 관리해야 해서
//  * 지금은 막는다.
//  */
// export class NodeBreakStatement extends AbstractStatement<ast.BreakStatement> {
//   constructor(app: App, tsNode: ast.BreakStatement) {
//     super(app, tsNode);
//     assert(!this.tsNode.label, `not implemented labeled break: ${this.getText()}`);
//   }
// }

// export class NodeContinueStatement extends AbstractStatement<ast.ContinueStatement> {
//   constructor(app: App, tsNode: ast.ContinueStatement) {
//     super(app, tsNode);
//     assert(!this.tsNode.label, `not implemented labeled continue: ${this.getText()}`);
//   }
// }

// export class NodeTypeAliasDeclaration extends AbstractStatement<ast.TypeAliasDeclaration> {
//   readonly isDeclared: boolean;

//   constructor(app: App, tsNode: ast.TypeAliasDeclaration) {
//     super(app, tsNode);
//     this.isDeclared = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Ambient);
//   }
// }

// export class NodeInterfaceDeclaration extends AbstractStatement<ast.InterfaceDeclaration> {
//   readonly isDeclared: boolean;

//   constructor(app: App, tsNode: ast.InterfaceDeclaration) {
//     super(app, tsNode);
//     this.isDeclared = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Ambient);
//   }
// }

// export class NodeClassDeclaration extends AbstractStatement<ast.ClassDeclaration> {
//   readonly isDeclared: boolean;

//   constructor(app: App, tsNode: ast.ClassDeclaration) {
//     super(app, tsNode);
//     this.isDeclared = isModifierFlagMatch(this.tsNode, ast.ModifierFlags.Ambient);
//   }
// }

// export class NodeAmbientDeclaration extends AbstractStatement {
//   constructor(app: App, tsNode: ast.Statement) {
//     super(app, tsNode);
//     // source file (non-d.ts)'s declaration should not reach here
//     assert(this.tsNode.getSourceFile().isDeclarationFile);
//   }
// }

// // region expression

// export class NodeIdentifier extends AbstractExpression<ast.Identifier> {
//   readonly text: string;
//   readonly symbol: AppSymbol;

//   constructor(app: App, tsNode?: ast.Identifier) {
//     assert(tsNode);
//     super(app, tsNode);
//     this.text = tsNode.text;
//     const symbol = app.symbolOf(this.tsNode);

//     assert(symbol, `symbol not found: ${tsNode.text}`);

//     this.symbol = symbol;
//   }
// }

// export class NodePrefixUnaryExpression extends AbstractExpression<ast.PrefixUnaryExpression> {
//   readonly operand: AbstractExpression;
//   readonly operator: ast.PrefixUnaryOperator;

//   constructor(app: App, tsNode: ast.PrefixUnaryExpression) {
//     super(app, tsNode);
//     this.operand = AbstractExpression.of(app, this.tsNode.operand);
//     this.operator = this.tsNode.operator;
//   }
// }

// export class NodePostfixUnaryExpression extends AbstractExpression<ast.PostfixUnaryExpression> {
//   readonly operand: NodeIdentifier;
//   readonly operator: ast.PostfixUnaryOperator;

//   constructor(app: App, tsNode: ast.PostfixUnaryExpression) {
//     super(app, tsNode);
//     assertExpectedNode(this.tsNode.operand, ast.isIdentifier);
//     this.operand = new NodeIdentifier(app, this.tsNode.operand);
//     this.operator = this.tsNode.operator;
//   }
// }

// export class NodeBinaryExpression extends AbstractExpression<ast.BinaryExpression> {
//   readonly left: AbstractExpression;
//   readonly binaryOperatorToken: NodeBinaryOperatorToken;
//   readonly right: AbstractExpression;

//   constructor(app: App, tsNode: ast.BinaryExpression) {
//     super(app, tsNode);
//     this.left = AbstractExpression.of(app, tsNode.left);
//     this.binaryOperatorToken = new NodeBinaryOperatorToken(app, tsNode.operatorToken);
//     this.right = AbstractExpression.of(app, tsNode.right);
//   }
// }

// export class NodeCallExpression extends AbstractExpression<ast.CallExpression> {
//   readonly expression: AbstractExpression;
//   readonly arguments: AbstractExpression[];

//   constructor(app: App, tsNode: ast.CallExpression) {
//     super(app, tsNode);
//     this.expression = AbstractExpression.of(app, tsNode.expression);
//     this.arguments = tsNode.arguments.map((arg) => AbstractExpression.of(app, arg));
//   }
// }

// export class NodeNumericLiteral extends AbstractExpression<ast.NumericLiteral> {
//   readonly value: string;

//   constructor(app: App, tsNode: ast.NumericLiteral) {
//     super(app, tsNode);
//     this.value = new BigNumber(tsNode.getText()).toFixed();
//   }
// }

// export class NodeBooleanLiteral extends AbstractExpression {
//   readonly value: boolean;

//   constructor(app: App, tsNode: ast.Expression) {
//     super(app, tsNode);
//     this.value = tsNode.kind === ast.SyntaxKind.TrueKeyword;
//   }
// }

// export class NodeStringLiteral extends AbstractExpression<ast.StringLiteral> {
//   readonly value: string;

//   constructor(app: App, tsNode: ast.StringLiteral) {
//     super(app, tsNode);
//     this.value = tsNode.text;
//   }
// }

// export class NodeParenthesizedExpression extends AbstractExpression<ast.ParenthesizedExpression> {
//   readonly expression: AbstractExpression;

//   constructor(app: App, tsNode: ast.ParenthesizedExpression) {
//     super(app, tsNode);
//     this.expression = AbstractExpression.of(app, this.tsNode.expression);
//   }
// }

// // region other node

// /** `.d.ts` 머리의 `ssc:include`. 꺾쇠는 include 검색 경로, 따옴표는 `.d.ts` 기준 경로다. */
// export const sscIncludeDirectivePrefix = 'ssc:include:';

// /**
//  * `.d.ts` 머리의 `ssc:link`. 꺾쇠는 시스템 라이브러리(`-l`), 그 밖에는 `.d.ts` 기준 경로다.
//  * `.c`는 따로 컴파일해 링크하고, 나머지는 링크 명령에 그대로 넘긴다.
//  */
// export const sscLinkDirectivePrefix = 'ssc:link:';

// /**
//  * `ssc:include:`, `ssc:link:` 지시문. 꺾쇠(`lib`)는 검색 경로에서 찾고, 그 밖(`path`)은 `.d.ts`
//  * 기준 경로라 절대 경로로 바꿔 둔다. `libOrPath`에는 꺾쇠를 뗀 값이 들어간다.
//  */
// export type SscLibOrPathDirective = {
//   directive: string;
//   libOrPath: string;
//   type: 'lib' | 'path';
// };

// export class AppSourceFile extends AbstractNode<ast.SourceFile> {
//   readonly index: number;
//   readonly fileName: string;
//   readonly isDeclarationFile: boolean;
//   readonly directives: readonly string[];
//   readonly statements: readonly AbstractStatement[];

//   constructor(app: App, tsNode: ast.SourceFile, index: number) {
//     super(app, tsNode);
//     this.index = index;
//     this.fileName = tsNode.fileName;
//     this.isDeclarationFile = tsNode.isDeclarationFile;
//     this.directives = this.getDirectives();
//     this.statements = tsNode.statements.map((s) => AbstractStatement.of(this.app, s));
//   }

//   private getDirectives() {
//     return this.getComments()
//       .values()
//       .map((r) => this.tsNode.text.slice(r.pos, r.end).trim())
//       .map((c) => c.replace(/^\/\/+/, '').trim())
//       .filter((c) => c.startsWith('ssc:'))
//       .toArray();
//   }

//   getIncludeDirectives() {
//     return this.directives
//       .filter((d) => d.startsWith(sscIncludeDirectivePrefix))
//       .map((d) => this.parseLibOrPath(sscIncludeDirectivePrefix, d));
//   }

//   getLinkDirectives() {
//     return this.directives
//       .filter((d) => d.startsWith(sscLinkDirectivePrefix))
//       .map((d) => this.parseLibOrPath(sscLinkDirectivePrefix, d));
//   }

//   /**
//    * `<이름>`은 검색 경로, 그 외에는 `.d.ts` 기준 경로다. 사람마다 다르게 쓰지 않도록 따옴표,
//    * 한쪽만 있는 꺾쇠, 공백은 받지 않는다.
//    */
//   private parseLibOrPath(prefix: string, directive: string): SscLibOrPathDirective {
//     const message = `${this.fileName}: invalid '${prefix}*' directive: ${directive}`;

//     assert(directive.startsWith(prefix), message);

//     const value = directive.replace(prefix, '');

//     if (value.startsWith('<') && value.endsWith('>')) {
//       const lib = value.slice(1, -1);

//       assert(lib, message);

//       return { directive, libOrPath: lib, type: 'lib' };
//     }

//     assert(value, message);

//     const resolvedPath = path.resolve(path.dirname(this.fileName), value);

//     return { directive, libOrPath: resolvedPath, type: 'path' };
//   }

//   private getComments() {
//     const { text, statements, endOfFileToken } = this.tsNode;
//     return [...statements, endOfFileToken].flatMap(
//       (node) => ast.getLeadingCommentRanges(text, node.pos) || [],
//     );
//   }

//   /**
//    * 이 파일이 정적으로 import하는 syscript 소스. 소스에 적힌 순서이며 JS의 모듈 평가도 이
//    * 순서를 따른다. `import type`처럼 JS 출력에서 지워지는 것과 실행할 코드가 없는 `.d.ts`는
//    * 뺀다. 타입으로만 쓰인 일반 import도 TS가 지우지만 아직 구분하지 않는다.
//    */
//   getRuntimeImports() {
//     return this.tsNode.statements
//       .values()
//       .filter((s) => {
//         if (ast.isImportDeclaration(s)) {
//           return s.importClause?.phaseModifier !== ast.SyntaxKind.TypeKeyword;
//         }

//         return !(ast.isExportDeclaration(s) && s.isTypeOnly);
//       })
//       .map(moduleSpecifierOf)
//       .filter((s) => s !== undefined)
//       .map((specifier) => {
//         const sourceFile = this.app.sourceFileOfModule(specifier);

//         assert(sourceFile, `${this.fileName}: module not resolved: ${specifier.text}`);

//         return sourceFile;
//       })
//       .filter((s) => !s.isDeclarationFile)
//       .toArray();
//   }

//   debugPrint() {
//     console.log({
//       index: this.index,
//       fileName: this.fileName,
//       isDeclarationFile: this.isDeclarationFile,
//       directives: this.directives,
//       statements: this.statements.length,
//     });

//     this.statements.forEach((nodeStatement) => {
//       printLine();
//       console.log(nodeStatement.getText());
//       printLine();
//       nodeStatement.print();
//     });
//   }
// }

// export class NodeVariableDeclaration extends AbstractNode<ast.VariableDeclaration> {
//   readonly isExported: boolean;
//   readonly keyword: 'const' | 'let';
//   readonly bindingName: NodeBindingName;
//   readonly type: AppType;
//   readonly initializer: AbstractExpression;

//   constructor(app: App, tsNode: ast.VariableDeclaration, isExported = false) {
//     super(app, tsNode);
//     this.isExported = isExported;

//     // `var`는 블록 스코프 플래그가 하나도 없다. 함수 스코프라 호이스팅해야 하고, 대입 전에
//     // 읽으면 JS는 `undefined`인데 C는 UB다.
//     if (!isNodeFlagMatch(tsNode.parent, ast.NodeFlags.BlockScoped)) {
//       throw new Error(`${this.location()}: 'var' is not allowed, use 'const' or 'let'`);
//     }

//     // `await using`은 `Const | Using`이라 `Const`보다 먼저 걸러야 `const`로 잡히지 않는다.
//     if (isNodeFlagMatch(tsNode.parent, ast.NodeFlags.Using)) {
//       throw new Error(
//         `${this.location()}: not implemented declaration: ${tsNode.parent.getText()}`,
//       );
//     }

//     if (isNodeFlagMatch(tsNode.parent, ast.NodeFlags.Const)) {
//       this.keyword = 'const';
//     } else if (isNodeFlagMatch(tsNode.parent, ast.NodeFlags.Let)) {
//       this.keyword = 'let';
//     } else {
//       throw new Error(
//         `${this.location()}: not implemented declaration: ${tsNode.parent.getText()}`,
//       );
//     }

//     this.bindingName = new NodeBindingName(app, this.tsNode.name);

//     const type = app.typeOf(this.tsNode);

//     assert(type, `type not found: ${this.tsNode.name.getText()}`);

//     this.type = type;
//     this.initializer = AbstractExpression.of(app, this.tsNode.initializer);
//   }
// }

// export class NodeParameterDeclaration extends AbstractNode<ast.ParameterDeclaration> {
//   readonly bindingName: NodeBindingName;
//   readonly type: AppType;

//   constructor(app: App, tsNode: ast.ParameterDeclaration) {
//     super(app, tsNode);
//     this.bindingName = new NodeBindingName(app, this.tsNode.name);

//     const type = app.typeOf(this.tsNode);

//     assert(type, `type not found: ${this.tsNode.name.getText()}`);

//     this.type = type;
//   }
// }

// export class NodeBindingName extends AbstractNode<ast.BindingName> {
//   readonly identifier: NodeIdentifier;

//   constructor(app: App, tsNode: ast.BindingName) {
//     super(app, tsNode);
//     assertExpectedNode(this.tsNode, ast.isIdentifier);
//     this.identifier = new NodeIdentifier(app, this.tsNode);
//   }
// }

// export class NodeEntityName extends AbstractNode<ast.EntityName> {
//   readonly identifier: NodeIdentifier;

//   constructor(app: App, tsNode: ast.EntityName) {
//     super(app, tsNode);
//     assertExpectedNode(this.tsNode, ast.isIdentifier);
//     this.identifier = new NodeIdentifier(app, this.tsNode);
//   }
// }

// export class NodeTypeNode extends AbstractNode<ast.TypeNode> {
//   readonly typeReferenceNode: NodeTypeReferenceNode;

//   constructor(app: App, tsNode?: ast.TypeNode) {
//     assert(tsNode);
//     super(app, tsNode);
//     assertExpectedNode(this.tsNode, ast.isTypeReferenceNode);
//     this.typeReferenceNode = new NodeTypeReferenceNode(app, this.tsNode);
//   }
// }

// export class NodeTypeReferenceNode extends AbstractNode<ast.TypeReferenceNode> {
//   readonly entityName: NodeEntityName;

//   constructor(app: App, tsNode: ast.TypeReferenceNode) {
//     super(app, tsNode);
//     this.entityName = new NodeEntityName(app, this.tsNode.typeName);
//   }
// }

// export class NodeBinaryOperatorToken extends AbstractNode<ast.BinaryOperatorToken> {
//   readonly text: string;
//   readonly flags: ast.NodeFlags;
//   readonly kind: ast.BinaryOperator;

//   constructor(app: App, tsNode: ast.BinaryOperatorToken) {
//     super(app, tsNode);
//     this.text = tsNode.getText();
//     this.flags = tsNode.flags;
//     this.kind = tsNode.kind;
//   }
// }

// export function isModifierFlagMatch(node: ast.ModifiersBase, flag: ast.ModifierFlags) {
//   return !!(node.modifierFlags & flag);
// }

// export function isNodeFlagMatch(node: ast.Node, flag: ast.NodeFlags) {
//   return !!(node.flags & flag);
// }

// export function isTypeFlagMatch(type: ts.Type, flag: ts.TypeFlags) {
//   return !!(type.flags & flag);
// }

// export function isSymbolFlagMatch(symbol: ts.Symbol, flag: ts.SymbolFlags) {
//   return !!(symbol.flags & flag);
// }
