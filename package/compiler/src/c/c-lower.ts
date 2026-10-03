import { assert } from '@syscript/share/util';
import * as ast from 'typescript7/unstable/ast';
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
import { AppType } from '~/ts/ts-parser.js';

type LowerOption = {
  /** 파일 경로 → 모듈 id. 어떤 id를 쓸지는 호출하는 쪽이 정한다. */
  moduleId: (fileName: string) => string;
  /** 모든 TU가 include하는 prelude `.d.ts`. */
  prelude: AppSourceFile;
};

/**
 * 번역 단위(소스 파일 하나)의 상태. `writer`만 함수를 내릴 때마다 바꾸고, 최상단 실행문은
 * 초기화 함수 본문인 `initWriter`에 쓴다.
 */
class LowerContext {
  readonly sourceFile: AppSourceFile;
  readonly module: CModule;
  /** 심볼 id → C 식별자. 키가 심볼이라 함수마다 같은 이름의 지역 변수가 있어도 겹치지 않는다. */
  readonly names = new Map<number, string>();
  /** 이 TU가 참조한 `.d.ts`. 렌더할 때 각 파일의 모듈을 include한다. */
  readonly declarationFiles = new Set<AppSourceFile>();
  readonly initWriter = new CWriter();
  writer = this.initWriter;
  /** 파일 경로 → 모듈 id. 어떤 id를 쓸지는 호출하는 쪽이 정한다. */
  readonly moduleId: (fileName: string) => string;
  /**
   * 심볼 id → 최상위 변수. 이 모듈의 것과 다른 모듈에서 가져온 것이 함께 있다. `tag`는 선언
   * 전에 접근될 수 있는 변수에만 있다.
   */
  readonly globals = new Map<number, { value: string; tag: string | undefined }>();
  readonly prelude: AppSourceFile;
  /** 마지막으로 쓴 지역 변수 번호. 모듈마다 하나다. */
  localCount = 0;

  constructor(sourceFile: AppSourceFile, option: LowerOption) {
    this.sourceFile = sourceFile;
    this.module = new CModule(sourceFile.fileName);
    this.moduleId = option.moduleId;
    this.prelude = option.prelude;
    // prelude의 typedef와 도우미는 lower가 직접 쓰므로 호출을 따라가지 않아도 항상 들인다.
    this.declarationFiles.add(option.prelude);
  }
}

/**
 * 소스 파일 하나를 C 파일 하나로 내린다. 함수 선언은 JS처럼 호이스팅되어 파일 스코프에
 * 놓이고, 나머지 최상단 문장은 소스 순서대로 초기화 함수 본문이 된다. 파일 사이의 초기화
 * 순서는 여기서 정하지 않는다.
 */
export function lower(sourceFile: AppSourceFile, option: LowerOption) {
  if (sourceFile.isDeclarationFile) {
    return undefined;
  }

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
    /**
     * 래퍼 헤더를 절대 경로로 include한다. 상대 경로는 검색 경로를 차례로 뒤져 의도하지 않은
     * 파일이 잡힐 수 있다. 래퍼는 모두 모듈 디렉터리에 있고, 그 위치는 emit이 정한다.
     */
    renderC: (buildDir: string) => {
      const { getHeaderPath } = cModuleLayout(buildDir);
      const headerPaths = context.declarationFiles
        .values()
        .map((s) => getHeaderPath(context.moduleId(s.fileName)))
        .toArray();

      return context.module.render(headerPaths);
    },
  };
}

function declareFunction(context: LowerContext, node: NodeFunctionDeclaration) {
  const params = node.parameters.map((p) => toCType(context, p.type));
  const name = functionName(context, node);

  context.module.declare(name, functionSignature(context, node, params));

  return name;
}

/**
 * syscript가 정의한 함수는 선언된 모듈의 이름 공간에 넣는다. 본문이 없는 `declare function`은
 * C 함수를 가리키므로 이름을 그대로 쓴다.
 */
function functionName(context: LowerContext, node: NodeFunctionDeclaration) {
  const name = cName(node.identifier);

  if (!node.block) {
    return name;
  }

  return cModuleFunctionName(context.moduleId(node.getSourceFile().fileName), name);
}

function lowerFunction(node: NodeFunctionDeclaration, context: LowerContext) {
  const writer = new CWriter();

  context.writer = writer;

  const params = node.parameters.map((parameter) => {
    const name = declareName(context, parameter.bindingName.identifier);

    return `${toCType(context, parameter.type)} ${name}`;
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

/** 최상단의 실행문을 소스 순서대로 초기화 함수에 담는다. 선언만 있는 문장은 건너뛴다. */
function lowerInit(context: LowerContext) {
  const { initWriter: writer, sourceFile } = context;
  const name = cModuleName(context.moduleId(sourceFile.fileName));

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
 * 최상위 변수는 파일 스코프의 전역이 된다. C 전역은 상수로만 초기화할 수 있어 선언만 여기서
 * 하고, 초깃값은 초기화 함수가 선언이 있던 자리에서 대입한다. 선언 전에 접근될 수 있는 변수는
 * 초기화 상태를 따로 두고, 초깃값 없이 `CTag.Uninitialized`(0)로 시작한다.
 */
function declareGlobals(context: LowerContext) {
  const { sourceFile } = context;
  const moduleId = context.moduleId(sourceFile.fileName);
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
      const value = cModuleVariableName(moduleId, cName(identifier));
      const linkage = declaration.isExported ? '' : 'static ';
      const isTdz = tdzVariables.has(identifier.symbol.id);
      const tag = isTdz ? cModuleTagName(moduleId, cName(identifier)) : undefined;

      context.module.declare(value, `${linkage}${toCType(context, declaration.type)} ${value}`);

      if (tag) {
        // 초깃값을 적지 않아 0, 즉 초기화 전으로 시작한다.
        context.module.declare(tag, `static ssc__type__u8 ${tag}`);
      }

      context.globals.set(identifier.symbol.id, { value, tag });
    }
  }
}

function lowerGlobalInit(node: NodeVariableDeclaration, context: LowerContext) {
  const global = context.globals.get(node.bindingName.identifier.symbol.id);

  assert(global, `global not declared: ${node.bindingName.identifier.text}`);

  context.writer.line(`${global.value} = ${lowerExpression(node.initializer, context)};`);

  // 초깃값을 계산하는 동안에는 아직 TDZ라 대입이 끝난 뒤에 초기화됐다고 표시한다.
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
    toCType(context, node.returnType),
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
    node.declarations.forEach((d) => lowerVariableDeclaration(d, context));
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
    lowerFor(node, context);
    return;
  }

  if (node instanceof NodeWhileStatement) {
    lowerWhile(node, context);
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

function lowerIf(node: NodeIfStatement, context: LowerContext, isElseIf = false) {
  const { writer } = context;

  writer.line(`${isElseIf ? '} else if' : 'if'} (${lowerCondition(node.expression, context)}) {`);
  writer.indent();
  lowerStatements(node.block.statements, context);
  lowerElse(node.elseStatement, context);
}

/** AST에서 `else if`는 else 안에 중첩된 if다. 그대로 내리면 블록이 깊어져 형제로 편다. */
function lowerElse(node: NodeBlock | NodeIfStatement | undefined, context: LowerContext) {
  const { writer } = context;

  writer.dedent();

  if (node instanceof NodeIfStatement) {
    lowerIf(node, context, true);
    return;
  }

  if (node instanceof NodeBlock) {
    writer.line('} else {');
    writer.indent();
    lowerStatements(node.statements, context);
    writer.dedent();
    writer.line('}');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  assert(node === undefined);

  writer.line('}');
}

function lowerFor(node: NodeForStatement, context: LowerContext) {
  const { writer } = context;
  const init = node.declarations.map((d) => variableDeclarationText(d, context)).join(', ');
  const condition = lowerCondition(node.condition, context);
  const incrementor = lowerExpression(node.incrementor, context);

  writer.line(`for (${init}; ${condition}; ${incrementor}) {`);
  writer.indent();
  lowerStatements(node.block.statements, context);
  writer.dedent();
  writer.line('}');
}

function lowerWhile(node: NodeWhileStatement, context: LowerContext) {
  const { writer } = context;

  writer.line(`while (${lowerCondition(node.expression, context)}) {`);
  writer.indent();
  lowerStatements(node.block.statements, context);
  writer.dedent();
  writer.line('}');
}

function lowerVariableDeclaration(node: NodeVariableDeclaration, context: LowerContext) {
  context.writer.line(`${variableDeclarationText(node, context)};`);
}

function variableDeclarationText(node: NodeVariableDeclaration, context: LowerContext) {
  const value = lowerExpression(node.initializer, context);
  const name = declareName(context, node.bindingName.identifier);
  const constness = node.keyword === 'const' ? 'const ' : '';

  return `${constness}${toCType(context, node.type)} ${name} = ${value}`;
}

/**
 * expression을 감싸는 truthy, falsy 호환 계층
 * 조건 자리는 JS 규칙을 따른다. boolean은 그대로 두고, 부동소수만 NaN 처리가 필요해
 * prelude를 거치며, 나머지는 `!= 0` 하나로 끝난다.
 */
function lowerCondition(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  if (node instanceof NodeParenthesizedExpression) {
    return lowerCondition(node.expression, context);
  }

  // `&&`, `||`는 양쪽이 각각 조건이다. 값 자리와 달리 C 연산자가 그대로 맞는다.
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
  const type = node.app.typeOf(node.tsNode);
  const name = type && sscTypeName(context, type);

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

    assert(callee instanceof NodeIdentifier, '직접 호출만 지원한다');

    const name = declareCallee(context, callee);

    return call(
      name,
      node.arguments.map((argument) => lowerExpression(argument, context)),
    );
  }

  throw new Error(`not implemented expression: ${node.getText()}`);
}

/** 이 모듈에 정의가 없으면 다른 모듈이나 prelude의 함수다. 선언만 남기면 링커가 채운다. */
function declareCallee(context: LowerContext, callee: NodeIdentifier) {
  const declaration = callee.app.declarationOf(callee.symbol);

  assert(
    declaration && ast.isFunctionDeclaration(declaration),
    `not function declaration: ${callee.text}`,
  );

  // `.d.ts`의 함수는 C 헤더가 선언 (ssc:include:*)
  if (declaration.getSourceFile().isDeclarationFile) {
    includeModule(context, callee, declaration.getSourceFile().fileName);
    // 이름은 그대로지만 `.ts`처럼 `ssc__` 접두어는 막는다. prelude 함수를 부를 수 없게 한다.
    return cName(callee);
  }

  return declareFunction(context, new NodeFunctionDeclaration(callee.app, declaration));
}

/** 선언이 있는 `.d.ts`의 clang 모듈을 이 TU에 들인다. */
function includeModule(context: LowerContext, callee: NodeIdentifier, fileName: string) {
  const sourceFile = callee.app.sourceFiles.find((s) => s.fileName === fileName);

  assert(sourceFile, `source file not found: ${fileName}`);

  if (!hasCIncludes(sourceFile)) {
    throw new Error(
      `${callee.location()}: '${callee.text}' is declared in ${fileName}, but it has no '${sscIncludeDirectivePrefix}*' directive`,
    );
  }

  context.declarationFiles.add(sourceFile);
}

function declareName(context: LowerContext, identifier: NodeIdentifier) {
  const moduleId = context.moduleId(context.sourceFile.fileName);
  const text = cModuleLocalVariableName(moduleId, ++context.localCount, cName(identifier));

  context.names.set(identifier.symbol.id, text);

  return text;
}

/**
 * 식별자의 C 식. 지역 변수가 아니면 최상위 변수다. 선언 전에 접근될 수 있는 변수는 함수
 * 안에서만 검사한다. 최상위 코드는 선언 뒤에서만 그 변수를 쓸 수 있어서다(TS2448). 검사한
 * 결과를 역참조해 lvalue로 돌려주므로 읽기, 대입, `++`가 모두 이 형태로 된다.
 */
function findName(context: LowerContext, identifier: NodeIdentifier) {
  const name = context.names.get(identifier.symbol.id);

  if (name) {
    return name;
  }

  const global =
    context.globals.get(identifier.symbol.id) || declareImportedGlobal(context, identifier);

  if (!global.tag || context.writer === context.initWriter) {
    return global.value;
  }

  return `(*(ssc__fn__validate_tdz(${global.tag} == ${CTag.Value}, "${identifier.text}"), &${global.value}))`;
}

/**
 * 다른 모듈이 export한 최상위 변수. 같은 전역을 `extern`으로 가리켜 JS의 live binding처럼
 * 바뀐 값을 그대로 본다. 순환 import가 막혀 있어 그 모듈의 초기화는 이미 끝났으므로 검사는
 * 필요 없다.
 */
function declareImportedGlobal(context: LowerContext, identifier: NodeIdentifier) {
  const { app } = identifier;
  const declaration = app.declarationOf(identifier.symbol);

  assert(
    declaration && ast.isVariableDeclaration(declaration),
    `스코프에 없다: ${identifier.text}`,
  );
  assert(
    !declaration.getSourceFile().isDeclarationFile,
    `${identifier.location()}: not implemented ambient variable: ${identifier.text}`,
  );

  // import할 때 이름을 바꿨을 수 있어 선언의 이름으로 짓는다.
  const variable = new NodeVariableDeclaration(app, declaration);
  const moduleId = context.moduleId(declaration.getSourceFile().fileName);
  const value = cModuleVariableName(moduleId, cName(variable.bindingName.identifier));
  const global = { value, tag: undefined };

  context.module.declare(value, `extern ${toCType(context, variable.type)} ${value}`);
  context.globals.set(identifier.symbol.id, global);

  return global;
}

/** `++`, `--`는 대입 대상만 받아야 하는데 그 검사가 없으므로 일부러 뺀다. */
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

function toCType(context: LowerContext, type: AppType) {
  return toCTypeName(sscTypeName(context, type));
}

/**
 * lower가 타입을 구분할 때 쓰는 이름. 타입 이름을 보는 곳은 모두 여기를 거친다.
 * - 이름만 같은 다른 파일의 타입(`import { i8 }` 등)이 prelude 타입으로 내려가지 않게 선언
 *   위치를 확인한다.
 * - `number`는 JS와 같은 `f64`다. 이후로는 `number`가 나타나지 않는다.
 */
function sscTypeName(context: LowerContext, type: AppType) {
  const declaration = type.symbol && context.sourceFile.app.declarationOf(type.symbol);
  const fileName = declaration?.getSourceFile().fileName;

  if (fileName && fileName !== context.prelude.fileName) {
    throw new Error(`'${type.name}' is not the prelude type, it is declared in ${fileName}`);
  }

  return type.name === 'number' ? 'f64' : type.name;
}
