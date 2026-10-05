import { assert } from '@syscript/share/util';
import * as ast from 'typescript7/unstable/ast';
import * as ts from 'typescript7/unstable/sync';
import { binary, call, CModule, CWriter, signature, unary } from '~/c/c-builder.js';
import {
  cModuleFunctionName,
  cModuleLayout,
  cModuleLocalVariableName,
  cModuleName,
  cModuleTagName,
  cModuleVariableName,
  CTag,
  hasCIncludes,
} from '~/c/c-module.js';
import { findTdzVariables } from '~/c/c-tdz.js';
import { cName, toCTypeName } from '~/c/c.js';
import {
  AbstractNode,
  AbstractStatement,
  AppSourceFile,
  isTypeFlagMatch,
  NodeBinaryExpression,
  NodeBlock,
  NodeBooleanLiteral,
  NodeBreakStatement,
  NodeCallExpression,
  NodeContinueStatement,
  NodeExpressionStatement,
  NodeForStatement,
  NodeFunctionDeclaration,
  NodeIdentifier,
  NodeIfStatement,
  NodeImportDeclaration,
  NodeNumericLiteral,
  NodeParenthesizedExpression,
  NodePostfixUnaryExpression,
  NodePrefixUnaryExpression,
  NodeReturnStatement,
  NodeVariableDeclaration,
  NodeVariableStatement,
  NodeWhileStatement,
  sscIncludeDirectivePrefix,
} from '~/ts/ts-node.js';
import { RealPath } from '~/util/path.js';

type LowerOption = {
  /** 파일 경로 → 모듈 id */
  moduleId: (path: RealPath) => string;
  /** 모든 TU가 include하는 prelude `.d.ts` */
  prelude: AppSourceFile;
};

/** 번역 단위(소스 파일 하나)의 상태. 최상단 실행문은 초기화 함수 본문인 `initWriter`에 쓴다. */
class LowerContext {
  readonly sourceFile: AppSourceFile;
  readonly module: CModule;
  /** 심볼 id → 지역 변수의 C 식별자 */
  readonly names = new Map<number, string>();
  /** 이 TU가 include하는 `.d.ts` */
  readonly declarationFiles = new Set<AppSourceFile>();
  readonly initWriter = new CWriter();
  writer = this.initWriter;
  readonly moduleId: (path: RealPath) => string;
  /** 심볼 id → 최상위 변수. `tag`는 선언 전에 접근될 수 있는 변수에만 있다. */
  readonly globals = new Map<number, { value: string; tag: string | undefined }>();
  readonly prelude: AppSourceFile;
  localCount = 0;

  constructor(sourceFile: AppSourceFile, option: LowerOption) {
    this.sourceFile = sourceFile;
    this.module = new CModule(sourceFile.realPath);
    this.moduleId = option.moduleId;
    this.prelude = option.prelude;
    this.declarationFiles.add(option.prelude);
  }
}

/**
 * 소스 파일 하나를 C 파일 하나로 내린다. 함수 선언은 파일 스코프에 놓이고, 나머지 최상단
 * 문장은 소스 순서대로 초기화 함수 본문이 된다.
 */
export function lower(sourceFile: AppSourceFile, option: LowerOption) {
  assert(
    !sourceFile.isDeclarationFile,
    `declaration file can not be lowered: ${sourceFile.realPath}`,
  );

  const context = new LowerContext(sourceFile, option);
  const functions = sourceFile.statements
    .filter((node) => node instanceof NodeFunctionDeclaration)
    .filter((node) => !!node.block);

  // 함수 본문이 최상위 변수를 찾을 수 있게 함수보다 먼저 선언한다.
  declareGlobals(context);

  for (const node of functions) {
    declareFunction(context, node);
  }

  for (const node of functions) {
    lowerFunction(node, context);
  }

  lowerInit(context);

  return {
    /** 래퍼 헤더는 의도하지 않은 파일이 잡히지 않게 절대 경로로 include한다. */
    renderC: (buildDir: string) => {
      const { getHeaderPath } = cModuleLayout(buildDir);
      const headerPaths = context.declarationFiles
        .values()
        .map((s) => getHeaderPath(context.moduleId(s.realPath)))
        .toArray();

      return context.module.render(headerPaths);
    },
  };
}

function declareFunction(context: LowerContext, node: NodeFunctionDeclaration) {
  const params = node.parameters.map((p) => toCType(context, p.bindingName.identifier.getType()));
  const name = functionName(context, node);

  context.module.declare(name, functionSignature(context, node, params));

  return name;
}

/** 본문이 없는 `declare function`은 C 함수를 가리키므로 이름을 그대로 쓴다. */
function functionName(context: LowerContext, node: NodeFunctionDeclaration) {
  const name = cName(node.identifier);

  if (!node.block) {
    return name;
  }

  const sourceFile = node.app.loadSourceFile(node.getSourceFile());

  return cModuleFunctionName(context.moduleId(sourceFile.realPath), name);
}

function lowerFunction(node: NodeFunctionDeclaration, context: LowerContext) {
  const writer = new CWriter();

  context.writer = writer;

  const params = node.parameters.map((parameter) => {
    const { identifier } = parameter.bindingName;
    const name = declareName(context, identifier);

    return `${toCType(context, identifier.getType())} ${name}`;
  });

  assert(node.block);

  writer.line(`${functionSignature(context, node, params)} {`);
  writer.indent();
  lowerStatements(node.block.statements, context);
  writer.dedent();
  writer.line('}');

  context.module.define(writer.render());
  context.writer = context.initWriter;
}

function lowerInit(context: LowerContext) {
  const { initWriter: writer, sourceFile } = context;
  const name = cModuleName(context.moduleId(sourceFile.realPath));

  context.module.declare(name, signature('', name, 'void', 'void'));
  writer.line(`${signature('', name, 'void', 'void')} {`);
  writer.indent();

  for (const node of sourceFile.statements) {
    if (node instanceof NodeFunctionDeclaration || node instanceof NodeImportDeclaration) {
      continue;
    }

    if (node instanceof NodeVariableStatement) {
      node.declarations.forEach((d) => lowerGlobalInit(d, context));
      continue;
    }

    lowerStatement(node, context);
  }

  writer.dedent();
  writer.line('}');

  context.module.define(writer.render());
}

/**
 * C 전역은 상수로만 초기화할 수 있어 선언만 하고, 초깃값은 초기화 함수가 대입한다. 선언 전에
 * 접근될 수 있는 변수는 `CTag.Uninitialized`(0)로 시작하는 초기화 상태를 따로 둔다.
 */
function declareGlobals(context: LowerContext) {
  const { sourceFile } = context;
  const moduleId = context.moduleId(sourceFile.realPath);
  const tdzVariables = findTdzVariables(sourceFile);

  for (const statement of sourceFile.statements) {
    if (!(statement instanceof NodeVariableStatement)) {
      continue;
    }

    if (statement.isDeclare) {
      throw new Error(`${statement.location()}: not implemented ambient variable`);
    }

    for (const declaration of statement.declarations) {
      const { identifier } = declaration.bindingName;
      const id = identifier.getSymbol().id;
      const value = cModuleVariableName(moduleId, cName(identifier));
      const linkage = declaration.isExported ? '' : 'static ';
      const tag = tdzVariables.has(id) ? cModuleTagName(moduleId, cName(identifier)) : undefined;

      context.module.declare(value, `${linkage}${toCType(context, identifier.getType())} ${value}`);

      if (tag) {
        context.module.declare(tag, `static ssc__type__u8 ${tag}`);
      }

      context.globals.set(id, { value, tag });
    }
  }
}

function lowerGlobalInit(node: NodeVariableDeclaration, context: LowerContext) {
  const { identifier } = node.bindingName;
  const global = context.globals.get(identifier.getSymbol().id);

  assert(global, `global not declared: ${identifier.text}`);

  context.writer.line(`${global.value} = ${lowerExpression(node.initializer, context)};`);

  // 초깃값을 계산하는 동안에는 아직 TDZ라 대입이 끝난 뒤에 표시한다.
  if (global.tag) {
    context.writer.line(`${global.tag} = ${CTag.Value};`);
  }
}

function functionSignature(
  context: LowerContext,
  node: NodeFunctionDeclaration,
  params: readonly string[],
) {
  return signature(
    node.isDeclared || node.isExported ? '' : 'static',
    functionName(context, node),
    toCType(context, node.getReturnType()),
    params.length ? params.join(', ') : 'void',
  );
}

function lowerStatements(statements: readonly AbstractStatement[], context: LowerContext) {
  for (const statement of statements) {
    lowerStatement(statement, context);
  }
}

function lowerStatement(node: AbstractStatement, context: LowerContext) {
  const { writer } = context;

  if (node instanceof NodeVariableStatement) {
    node.declarations.forEach((d) => writer.line(`${variableDeclarationText(d, context)};`));
    return;
  }

  if (node instanceof NodeExpressionStatement) {
    writer.line(`${lowerExpression(node.expression, context)};`);
    return;
  }

  if (node instanceof NodeReturnStatement) {
    writer.line(`return ${lowerExpression(node.expression, context)};`);
    return;
  }

  if (node instanceof NodeBlock) {
    writer.line('{');
    writer.indent();
    lowerStatements(node.statements, context);
    writer.dedent();
    writer.line('}');
    return;
  }

  if (node instanceof NodeIfStatement) {
    lowerIf(node, context);
    return;
  }

  if (node instanceof NodeForStatement) {
    const init = node.declarations.map((d) => variableDeclarationText(d, context)).join(', ');
    const condition = lowerCondition(node.condition, context);
    const incrementor = lowerExpression(node.incrementor, context);

    writer.line(`for (${init}; ${condition}; ${incrementor}) {`);
    writer.indent();
    lowerStatements(node.block.statements, context);
    writer.dedent();
    writer.line('}');
    return;
  }

  if (node instanceof NodeWhileStatement) {
    writer.line(`while (${lowerCondition(node.expression, context)}) {`);
    writer.indent();
    lowerStatements(node.block.statements, context);
    writer.dedent();
    writer.line('}');
    return;
  }

  if (node instanceof NodeBreakStatement) {
    writer.line('break;');
    return;
  }

  if (node instanceof NodeContinueStatement) {
    writer.line('continue;');
    return;
  }

  throw new Error(`not implemented statement: ${node.getText()}`);
}

/** AST에서 `else if`는 else 안에 중첩된 if라 형제로 펴서 내린다. */
function lowerIf(node: NodeIfStatement, context: LowerContext, isElseIf = false) {
  const { writer } = context;
  const { elseStatement } = node;

  writer.line(`${isElseIf ? '} else if' : 'if'} (${lowerCondition(node.expression, context)}) {`);
  writer.indent();
  lowerStatements(node.block.statements, context);
  writer.dedent();

  if (elseStatement instanceof NodeIfStatement) {
    lowerIf(elseStatement, context, true);
    return;
  }

  if (elseStatement instanceof NodeBlock) {
    writer.line('} else {');
    writer.indent();
    lowerStatements(elseStatement.statements, context);
    writer.dedent();
  }

  writer.line('}');
}

function variableDeclarationText(node: NodeVariableDeclaration, context: LowerContext) {
  const { identifier } = node.bindingName;
  const value = lowerExpression(node.initializer, context);
  const name = declareName(context, identifier);
  const constness = node.keyword === 'const' ? 'const ' : '';

  return `${constness}${toCType(context, identifier.getType())} ${name} = ${value}`;
}

/**
 * 조건 자리는 JS의 truthy 규칙을 따른다. boolean은 그대로, 부동소수는 NaN 때문에 prelude를
 * 거치고, 나머지는 `!= 0`이다.
 */
function lowerCondition(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  if (node instanceof NodeParenthesizedExpression) {
    return lowerCondition(node.expression, context);
  }

  // `&&`, `||`는 양쪽이 각각 조건이라 C 연산자가 그대로 맞는다.
  if (
    node instanceof NodeBinaryExpression
    && ast.isLogicalOperator(node.binaryOperatorToken.kind)
  ) {
    return binary(
      lowerCondition(node.left, context),
      operatorText(node.binaryOperatorToken.kind),
      lowerCondition(node.right, context),
    );
  }

  const text = lowerExpression(node, context);
  const name = sscTypeName(context, node.getType());

  if (name === 'boolean') {
    return text;
  }

  if (name === 'f32' || name === 'f64') {
    return call(`ssc__fn__truthy_${name}`, [text]);
  }

  return binary(text, '!=', '0');
}

function lowerExpression(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  if (node instanceof NodeNumericLiteral) {
    return node.value;
  }

  if (node instanceof NodeBooleanLiteral) {
    return String(node.value);
  }

  if (node instanceof NodeIdentifier) {
    return findName(context, node);
  }

  if (node instanceof NodePrefixUnaryExpression) {
    return node.operator === ast.SyntaxKind.ExclamationToken ?
        unary('!', lowerCondition(node.operand, context))
      : unary(prefixOperatorText(node.operator), lowerExpression(node.operand, context));
  }

  if (node instanceof NodePostfixUnaryExpression) {
    const operator = node.operator === ast.SyntaxKind.PlusPlusToken ? '++' : '--';
    return `${findName(context, node.operand)}${operator}`;
  }

  if (node instanceof NodeParenthesizedExpression) {
    return lowerExpression(node.expression, context);
  }

  if (node instanceof NodeBinaryExpression) {
    if (ast.isLogicalOperator(node.binaryOperatorToken.kind)) {
      throw new Error(
        `${node.location()}: '${operatorText(node.binaryOperatorToken.kind)}': not implemented logical operator`,
      );
    }

    return binary(
      lowerExpression(node.left, context),
      operatorText(node.binaryOperatorToken.kind),
      lowerExpression(node.right, context),
    );
  }

  if (node instanceof NodeCallExpression) {
    const callee = node.expression;

    assert(callee instanceof NodeIdentifier, `${node.location()}: only direct call is supported`);

    const name = declareCallee(context, callee);

    return call(
      name,
      node.arguments.map((argument) => lowerExpression(argument, context)),
    );
  }

  throw new Error(`not implemented expression: ${node.getText()}`);
}

/**
 * 이 모듈에 정의가 없으면 다른 모듈이나 `.d.ts`의 함수라 선언만 남긴다. `.d.ts`의 함수는
 * `ssc:include:*`의 C 헤더가 선언하므로 그 모듈을 include한다.
 */
function declareCallee(context: LowerContext, callee: NodeIdentifier) {
  const { app } = callee;
  const declaration = callee.getValueDeclaration();

  assert(ast.isFunctionDeclaration(declaration), `not function declaration: ${callee.text}`);

  const tsSourceFile = declaration.getSourceFile();

  if (!tsSourceFile.isDeclarationFile) {
    return declareFunction(context, new NodeFunctionDeclaration(app, declaration));
  }

  const sourceFile = app.loadSourceFile(tsSourceFile);

  if (!hasCIncludes(sourceFile)) {
    throw new Error(
      `${callee.location()}: '${callee.text}' is declared in ${sourceFile.realPath}, but it has no '${sscIncludeDirectivePrefix}*' directive`,
    );
  }

  context.declarationFiles.add(sourceFile);

  // `ssc__` 접두어는 cName이 막아 prelude 함수를 부를 수 없다.
  return cName(callee);
}

function declareName(context: LowerContext, identifier: NodeIdentifier) {
  const moduleId = context.moduleId(context.sourceFile.realPath);
  const text = cModuleLocalVariableName(moduleId, ++context.localCount, cName(identifier));

  context.names.set(identifier.getSymbol().id, text);

  return text;
}

/**
 * 식별자의 C lvalue. 지역 변수가 아니면 최상위 변수다. 선언 전에 접근될 수 있는 변수는 함수
 * 안에서만 검사한다. 최상위 코드는 선언 전에 쓰면 TS가 막는다(TS2448).
 */
function findName(context: LowerContext, identifier: NodeIdentifier) {
  const id = identifier.getSymbol().id;
  const name = context.names.get(id);

  if (name) {
    return name;
  }

  const global = context.globals.get(id) || declareImportedGlobal(context, identifier, id);

  if (!global.tag || context.writer === context.initWriter) {
    return global.value;
  }

  return `(*(ssc__fn__validate_tdz(${global.tag} == ${CTag.Value}, "${identifier.text}"), &${global.value}))`;
}

/**
 * 다른 모듈이 export한 최상위 변수를 `extern`으로 가리킨다. TODO: 순환 import에서는 그 모듈의
 * 초기화가 끝나지 않았을 수 있어 TDZ 검사가 필요하다.
 */
function declareImportedGlobal(context: LowerContext, identifier: NodeIdentifier, id: number) {
  const declaration = identifier.getValueDeclaration();

  assert(ast.isVariableDeclaration(declaration), `not in scope: ${identifier.text}`);
  assert(
    !declaration.getSourceFile().isDeclarationFile,
    `${identifier.location()}: not implemented ambient variable: ${identifier.text}`,
  );

  // import할 때 이름을 바꿨을 수 있어 선언의 이름으로 짓는다.
  const variable = new NodeVariableDeclaration(identifier.app, declaration);
  const sourceFile = identifier.app.loadSourceFile(declaration.getSourceFile());
  const moduleId = context.moduleId(sourceFile.realPath);
  const { identifier: declarationIdentifier } = variable.bindingName;
  const value = cModuleVariableName(moduleId, cName(declarationIdentifier));
  const global = { value, tag: undefined };

  context.module.declare(
    value,
    `extern ${toCType(context, declarationIdentifier.getType())} ${value}`,
  );
  context.globals.set(id, global);

  return global;
}

/** `++`, `--`는 대입 대상 검사가 없어 뺀다. */
function prefixOperatorText(operator: ast.PrefixUnaryOperator) {
  const allowOperators = ['-', '+', '!', '~'];
  const text = ast.tokenToString(operator);

  assert(text, `operator not found: ${operator}`);
  assert(allowOperators.includes(text), `not implemented operator: ${text}`);

  return text;
}

function operatorText(kind: ast.BinaryOperator) {
  const text = operatorMap[kind as keyof typeof operatorMap];

  assert(text, `not implemented operator: ${ast.SyntaxKind[kind]}`);

  return text;
}

const operatorMap = {
  [ast.SyntaxKind.AmpersandAmpersandToken]: '&&',
  [ast.SyntaxKind.BarBarToken]: '||',
  [ast.SyntaxKind.PlusToken]: '+',
  [ast.SyntaxKind.MinusToken]: '-',
  [ast.SyntaxKind.AsteriskToken]: '*',
  [ast.SyntaxKind.SlashToken]: '/',
  [ast.SyntaxKind.PercentToken]: '%',
  [ast.SyntaxKind.LessThanToken]: '<',
  [ast.SyntaxKind.LessThanEqualsToken]: '<=',
  [ast.SyntaxKind.GreaterThanToken]: '>',
  [ast.SyntaxKind.GreaterThanEqualsToken]: '>=',
  [ast.SyntaxKind.EqualsEqualsEqualsToken]: '==',
  [ast.SyntaxKind.ExclamationEqualsEqualsToken]: '!=',
  [ast.SyntaxKind.EqualsToken]: '=',
  [ast.SyntaxKind.PlusEqualsToken]: '+=',
  [ast.SyntaxKind.MinusEqualsToken]: '-=',
  [ast.SyntaxKind.AsteriskEqualsToken]: '*=',
} as const;

function toCType(context: LowerContext, type: ts.Type) {
  return toCTypeName(sscTypeName(context, type));
}

/**
 * lower가 타입을 구분할 때 쓰는 이름. `boolean`은 `true | false` 유니온이라 유니온보다 먼저
 * 본다. `number`와 숫자 리터럴은 `f64`다. 나머지는 prelude에 선언된 타입 별칭이어야 한다.
 */
function sscTypeName(context: LowerContext, type: ts.Type) {
  if (isTypeFlagMatch(type, ts.TypeFlags.BooleanLike)) {
    return 'boolean';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Void)) {
    return 'void';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return 'f64';
  }

  const { checker } = context.sourceFile.app;

  if (type.isUnionType()) {
    throw new Error(`not implemented union type: ${checker.typeToString(type)}`);
  }

  const symbol = type.getAliasSymbol();

  assert(symbol, `not implemented type: ${checker.typeToString(type)}`);

  const declarationFile = symbol.declarations[0]?.resolve()?.getSourceFile();

  assert(declarationFile, `declaration not found: ${symbol.name}`);

  const realPath = context.sourceFile.app.parser.tsPathToRealPath(declarationFile.fileName);

  if (realPath !== context.prelude.realPath) {
    throw new Error(`'${symbol.name}' is not the prelude type, it is declared in ${realPath}`);
  }

  return symbol.name;
}
