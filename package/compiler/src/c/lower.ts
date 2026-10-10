import { assert } from '@syscript/share/util';
import BigNumber from 'bignumber.js';
import * as ast from 'typescript7/unstable/ast';
import * as ts from 'typescript7/unstable/sync';
import { binary, call, cast, CModule, CWriter, signature, unary } from '~/c/c-builder.js';
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
import { includes, sscFloatTypes, SscNumberType, sscNumberTypes } from '~/ssc/type.js';
import {
  cNumericLiteral,
  commonType,
  CommonTypeOperand,
  isLiteralInRange,
  isLossless,
  parseNumericLiteral,
} from '~/ts/common-type.js';
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
  NodeNullLiteral,
  NodeNumericLiteral,
  NodeParenthesizedExpression,
  NodePostfixUnaryExpression,
  NodePrefixUnaryExpression,
  NodeReturnStatement,
  NodeStringLiteral,
  NodeTypeOfExpression,
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

/** C 변수. `type`은 C에 선언한 저장 타입이라 TS가 흐름으로 좁힌 타입과 다를 수 있다. */
type Variable = { value: string; type: string };

/** 번역 단위(소스 파일 하나)의 상태. 최상단 실행문은 초기화 함수 본문인 `initWriter`에 쓴다. */
class LowerContext {
  readonly sourceFile: AppSourceFile;
  readonly module: CModule;
  /** 심볼 id → 지역 변수의 C 식별자와 저장 타입 */
  readonly names = new Map<number, Variable>();
  /** 이 TU가 include하는 `.d.ts` */
  readonly declarationFiles = new Set<AppSourceFile>();
  readonly initWriter = new CWriter();
  writer = this.initWriter;
  readonly moduleId: (path: RealPath) => string;
  /** 심볼 id → 최상위 변수. `tag`는 선언 전에 접근될 수 있는 변수에만 있다. */
  readonly globals = new Map<number, Variable & { tag: string | undefined }>();
  readonly prelude: AppSourceFile;
  localCount = 0;
  /** 내리고 있는 함수의 반환 타입. 최상위 코드에서는 없다. */
  currentFnReturnType: string | undefined;

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
    const { value, type } = declareName(context, parameter.bindingName.identifier);

    return `${toCTypeName(type)} ${value}`;
  });

  assert(node.block);

  writer.line(`${functionSignature(context, node, params)} {`);
  writer.indent();
  context.currentFnReturnType = sscTypeName(context, node.getReturnType());
  lowerStatements(node.block.statements, context);
  context.currentFnReturnType = undefined;
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
      const type = sscTypeName(context, identifier.getType());

      context.module.declare(value, `${linkage}${toCTypeName(type)} ${value}`);

      if (tag) {
        context.module.declare(tag, `static ssc__type__u8 ${tag}`);
      }

      context.globals.set(id, { value, type, tag });
    }
  }
}

function lowerGlobalInit(node: NodeVariableDeclaration, context: LowerContext) {
  const { identifier } = node.bindingName;
  const global = context.globals.get(identifier.getSymbol().id);

  assert(global, `global not declared: ${identifier.text}`);

  const value = lowerValue(node.initializer, global.type, context);

  context.writer.line(`${global.value} = ${value};`);

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
    assert(context.currentFnReturnType, `${node.location()}: return outside of a function`);
    writer.line(`return ${lowerValue(node.expression, context.currentFnReturnType, context)};`);
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
  const value = lowerValue(node.initializer, sscTypeName(context, identifier.getType()), context);
  const variable = declareName(context, identifier);
  const constness = node.keyword === 'const' ? 'const ' : '';

  return `${constness}${toCTypeName(variable.type)} ${variable.value} = ${value}`;
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

  if (unionMembersOf(name)) {
    throw new Error(`${node.location()}: not implemented truthiness of union: ${name}`);
  }

  return binary(text, '!=', cNumericLiteral(new BigNumber(0), numberTypeOf(node, context)));
}

function lowerExpression(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  // a literal without a place to take its type from is f64
  const literal = numericLiteralOf(node);

  if (literal) {
    return cNumericLiteral(literal, 'f64');
  }

  if (node instanceof NodeBooleanLiteral) {
    return String(node.value);
  }

  if (node instanceof NodeNullLiteral) {
    return '(ssc__type__null){}';
  }

  if (node instanceof NodeIdentifier) {
    return lowerIdentifier(node, context);
  }

  if (node instanceof NodePrefixUnaryExpression) {
    if (node.operator === ast.SyntaxKind.ExclamationToken) {
      return unary('!', lowerCondition(node.operand, context));
    }

    // `+x` is f64
    if (node.operator === ast.SyntaxKind.PlusToken) {
      return lowerNumber(node.operand, 'f64', context);
    }

    if (
      node.operator === ast.SyntaxKind.PlusPlusToken
      || node.operator === ast.SyntaxKind.MinusMinusToken
    ) {
      return lowerUpdate(node, context);
    }

    const type = numberTypeOf(node, context);
    const operand = lowerNumber(node.operand, type, context);

    if (node.operator === ast.SyntaxKind.MinusToken) {
      return includes(sscFloatTypes, type) ?
          unary('-', operand)
        : call(`ssc__fn__sub_${type}`, [cNumericLiteral(new BigNumber(0), type), operand]);
    }

    return call(`ssc__fn__bitwise_not_${type}`, [operand]);
  }

  if (node instanceof NodePostfixUnaryExpression) {
    return lowerUpdate(node, context);
  }

  if (node instanceof NodeParenthesizedExpression) {
    return lowerExpression(node.expression, context);
  }

  if (node instanceof NodeBinaryExpression) {
    const { kind } = node.binaryOperatorToken;

    if (ast.isLogicalOperator(kind)) {
      const isBoolean = [node, node.left, node.right].every(
        (n) => sscTypeName(context, n.getType()) === 'boolean',
      );

      if (!isBoolean) {
        throw new Error(
          `${node.location()}: '${operatorText(kind)}': not implemented logical operator on non-boolean`,
        );
      }

      return binary(
        lowerExpression(node.left, context),
        operatorText(kind),
        lowerExpression(node.right, context),
      );
    }

    return lowerBinary(node, context);
  }

  if (node instanceof NodeCallExpression) {
    const callee = node.expression;

    assert(callee instanceof NodeIdentifier, `${node.location()}: only direct call is supported`);

    const preludeFunction = preludeFunctionOf(context, callee);

    if (preludeFunction) {
      const [left, right] = node.arguments;

      assert(left && right, `${node.location()}: '${callee.text}' takes two arguments`);

      const type = commonType([operandOf(left, context), operandOf(right, context)]);
      const resultType = sscTypeName(context, node.getType());

      if (type !== resultType) {
        throw new Error(`${node.location()}: common type ${type} does not match ${resultType}`);
      }

      return call(`ssc__fn__${preludeFunction}_${type}`, [
        lowerNumber(left, type, context),
        lowerNumber(right, type, context),
      ]);
    }

    const name = declareCallee(context, callee);
    const declaration = callee.getValueDeclaration();

    assert(ast.isFunctionDeclaration(declaration), `not function declaration: ${callee.text}`);

    const { parameters } = new NodeFunctionDeclaration(callee.app, declaration);

    return call(
      name,
      node.arguments.map((argument, index) => {
        const parameter = parameters[index];

        assert(parameter, `${argument.location()}: no parameter for the argument`);

        return lowerValue(
          argument,
          sscTypeName(context, parameter.bindingName.identifier.getType()),
          context,
        );
      }),
    );
  }

  throw new Error(`not implemented expression: ${node.getText()}`);
}

/** prelude `.d.ts`의 함수 → 타입별 C 함수(`ssc__fn__add_wrap_i32` 등)의 이름 */
const preludeFunctions: Partial<Record<string, string>> = {
  addWrap: 'add_wrap',
  subWrap: 'sub_wrap',
  mulWrap: 'mul_wrap',
};

/** prelude에 선언된 함수면 C 이름. 정수 타입마다 따로 있어 호출 자리에서 타입을 붙인다. */
function preludeFunctionOf(context: LowerContext, callee: NodeIdentifier) {
  const declarationFile = callee.getValueDeclaration().getSourceFile();
  const realPath = context.sourceFile.app.parser.tsPathToRealPath(declarationFile.fileName);

  if (realPath !== context.prelude.realPath) {
    return undefined;
  }

  const name = preludeFunctions[callee.text];

  if (!name) {
    throw new Error(`${callee.location()}: not implemented prelude function: ${callee.text}`);
  }

  return name;
}

/** 정수 연산은 넘침을 검사하는 prelude 함수(`ssc__fn__add_i32` 등)로 내린다. */
const arithmeticOperators: Partial<Record<ast.SyntaxKind, string>> = {
  [ast.SyntaxKind.PlusToken]: 'add',
  [ast.SyntaxKind.MinusToken]: 'sub',
  [ast.SyntaxKind.AsteriskToken]: 'mul',
  [ast.SyntaxKind.SlashToken]: 'div',
  [ast.SyntaxKind.PercentToken]: 'rem',
  [ast.SyntaxKind.AmpersandToken]: 'bitwise_and',
  [ast.SyntaxKind.BarToken]: 'bitwise_or',
  [ast.SyntaxKind.CaretToken]: 'bitwise_xor',
};

const comparisonOperators = [
  ast.SyntaxKind.LessThanToken,
  ast.SyntaxKind.LessThanEqualsToken,
  ast.SyntaxKind.GreaterThanToken,
  ast.SyntaxKind.GreaterThanEqualsToken,
  ast.SyntaxKind.EqualsEqualsEqualsToken,
  ast.SyntaxKind.ExclamationEqualsEqualsToken,
];

/** 복합 대입 → 그 산술 연산 */
const compoundAssignmentOperators: Partial<Record<ast.SyntaxKind, ast.BinaryOperator>> = {
  [ast.SyntaxKind.PlusEqualsToken]: ast.SyntaxKind.PlusToken,
  [ast.SyntaxKind.MinusEqualsToken]: ast.SyntaxKind.MinusToken,
  [ast.SyntaxKind.AsteriskEqualsToken]: ast.SyntaxKind.AsteriskToken,
  [ast.SyntaxKind.SlashEqualsToken]: ast.SyntaxKind.SlashToken,
  [ast.SyntaxKind.PercentEqualsToken]: ast.SyntaxKind.PercentToken,
  [ast.SyntaxKind.AmpersandEqualsToken]: ast.SyntaxKind.AmpersandToken,
  [ast.SyntaxKind.BarEqualsToken]: ast.SyntaxKind.BarToken,
  [ast.SyntaxKind.CaretEqualsToken]: ast.SyntaxKind.CaretToken,
};

/**
 * 산술과 비교는 두 피연산자를 공통 타입으로 맞춰 C의 정수 승격과 부호 변환 규칙을 피한다.
 * 대입은 왼쪽 타입으로 맞춘다. 공통 타입은 checker와 같은 규칙으로 다시 계산한다.
 */
function lowerBinary(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;
  const operator = operatorText(kind);

  if (kind in arithmeticOperators) {
    const common = commonType([operandOf(node.left, context), operandOf(node.right, context)]);
    const resultType = sscTypeName(context, node.getType());

    if (common !== resultType) {
      throw new Error(`${node.location()}: common type ${common} does not match ${resultType}`);
    }

    return arithmetic(
      kind,
      common,
      lowerNumber(node.left, common, context),
      lowerNumber(node.right, common, context),
    );
  }

  if (
    kind === ast.SyntaxKind.EqualsEqualsEqualsToken
    || kind === ast.SyntaxKind.ExclamationEqualsEqualsToken
  ) {
    const check = lowerTypeCheck(node, context);

    if (check) {
      return kind === ast.SyntaxKind.EqualsEqualsEqualsToken ? check : unary('!', check);
    }
  }

  if (comparisonOperators.includes(kind) && isNumber(node.left, context)) {
    const common = commonType([operandOf(node.left, context), operandOf(node.right, context)]);

    return binary(
      lowerNumber(node.left, common, context),
      operator,
      lowerNumber(node.right, common, context),
    );
  }

  if (kind === ast.SyntaxKind.EqualsToken) {
    assert(
      node.left instanceof NodeIdentifier,
      `${node.location()}: only identifier is assignable`,
    );

    const variable = findName(context, node.left);

    return binary(variable.value, operator, lowerValue(node.right, variable.type, context));
  }

  const compoundOperator = compoundAssignmentOperators[kind];

  if (compoundOperator) {
    const target = numberTypeOf(node.left, context);
    const common = commonType([{ type: target }, operandOf(node.right, context)]);

    if (common !== target) {
      throw new Error(`${node.location()}: '${operator}' widens ${target} to ${common}`);
    }

    // 왼쪽을 두 번 쓰므로 부수 효과가 없는 식별자만 받는다.
    assert(
      node.left instanceof NodeIdentifier,
      `${node.location()}: only identifier is assignable`,
    );

    const { value: left, type: storage } = findName(context, node.left);

    if (storage !== target) {
      throw new Error(`${node.location()}: '${operator}' on ${storage} is not implemented`);
    }

    return binary(
      left,
      '=',
      arithmetic(compoundOperator, target, left, lowerNumber(node.right, target, context)),
    );
  }

  return binary(
    lowerExpression(node.left, context),
    operator,
    lowerExpression(node.right, context),
  );
}

/** 실수는 IEEE 754를 따르는 C 연산자를 그대로 쓴다. */
function arithmetic(kind: ast.BinaryOperator, type: SscNumberType, left: string, right: string) {
  const name = arithmeticOperators[kind];

  assert(name, `not arithmetic operator: ${ast.SyntaxKind[kind]}`);

  if (includes(sscFloatTypes, type)) {
    return binary(left, operatorText(kind), right);
  }

  return call(`ssc__fn__${name}_${type}`, [left, right]);
}

/** 값을 `target` 자리에 맞춰 내린다. 숫자와 유니온이 아닌 자리는 그대로 내린다. */
function lowerValue(node: AbstractNode<ast.Expression>, target: string, context: LowerContext) {
  const members = unionMembersOf(target);

  if (members) {
    return lowerUnion(node, members, context);
  }

  return includes(sscNumberTypes, target) ?
      lowerNumber(node, target, context)
    : lowerExpression(node, context);
}

/**
 * 값을 유니온 자리에 담는다. 유니온은 그대로 두고, 멤버가 아닌 숫자는 손실 없이 담기는 첫
 * 멤버로 바꿔 담는다. 리터럴은 범위에 맞는 첫 멤버다.
 */
function lowerUnion(
  node: AbstractNode<ast.Expression>,
  members: readonly string[],
  context: LowerContext,
) {
  const source = sscTypeName(context, node.getType());
  const sourceMembers = unionMembersOf(source);
  const literal = numericLiteralOf(node);
  const target = `union:${members.join('|')}`;

  if (sourceMembers) {
    const missing = sourceMembers.find((m) => !members.includes(m));

    if (missing) {
      throw new Error(
        `${node.location()}: not implemented union conversion: ${source} to ${target}`,
      );
    }

    return lowerExpression(node, context);
  }

  if (!includes(sscNumberTypes, source) && members.includes(source)) {
    return call(`ssc__fn__union_from_${source}`, [lowerExpression(node, context)]);
  }

  const numbers = members.filter((m) => includes(sscNumberTypes, m));
  const member =
    literal ? numbers.find((m) => isLiteralInRange(literal, m))
    : includes(sscNumberTypes, source) ?
      numbers.find((m) => m === source) || numbers.find((m) => isLossless(source, m))
    : undefined;

  if (!member) {
    throw new Error(`${node.location()}: ${source} can not be put in ${target}`);
  }

  return call(`ssc__fn__union_from_${member}`, [lowerNumber(node, member, context)]);
}

/** 리터럴은 `target`의 C 리터럴로, 나머지는 타입이 다르면 손실 없는 경우만 캐스트한다. */
function lowerNumber(
  node: AbstractNode<ast.Expression>,
  target: SscNumberType,
  context: LowerContext,
) {
  const literal = numericLiteralOf(node);

  if (literal) {
    return cNumericLiteral(literal, target);
  }

  const text = lowerExpression(node, context);
  const members = unionMembersOf(sscTypeName(context, node.getType()));

  if (members) {
    const lossy = members.find((m) => !includes(sscNumberTypes, m) || !isLossless(m, target));

    if (lossy) {
      throw new Error(
        `${node.location()}: ${lossy} in the union can not be converted to ${target}`,
      );
    }

    return call(`ssc__fn__union_number_to_${target}`, [text]);
  }

  const source = numberTypeOf(node, context);

  if (source === target) {
    return text;
  }

  if (!isLossless(source, target)) {
    throw new Error(`${node.location()}: ${source} can not be converted to ${target} without loss`);
  }

  return cast(toCTypeName(target), text);
}

/** 숫자 유니온은 멤버들의 공통 타입인 피연산자다. */
function operandOf(node: AbstractNode<ast.Expression>, context: LowerContext): CommonTypeOperand {
  const literal = numericLiteralOf(node);
  const members = unionMembersOf(sscTypeName(context, node.getType()));

  if (literal) {
    return { literal };
  }

  if (members?.every((m) => includes(sscNumberTypes, m))) {
    return { type: commonType(members.map((type) => ({ type }))) };
  }

  return { type: numberTypeOf(node, context) };
}

function isNumber(node: AbstractNode<ast.Expression>, context: LowerContext) {
  const name = sscTypeName(context, node.getType());
  const members = unionMembersOf(name);

  return (
    !!numericLiteralOf(node)
    || includes(sscNumberTypes, name)
    || !!members?.every((m) => includes(sscNumberTypes, m))
  );
}

function numberTypeOf(node: AbstractNode<ast.Expression>, context: LowerContext) {
  const name = sscTypeName(context, node.getType());

  if (!includes(sscNumberTypes, name)) {
    throw new Error(`${node.location()}: not a number: ${name}`);
  }

  return name;
}

/** 숫자 리터럴과 부호를 붙인 숫자 리터럴. 괄호는 벗겨서 본다. */
function numericLiteralOf(node: AbstractNode<ast.Expression>): BigNumber | undefined {
  if (node instanceof NodeParenthesizedExpression) {
    return numericLiteralOf(node.expression);
  }

  if (node instanceof NodeNumericLiteral) {
    return parseNumericLiteral(node.getText(), false);
  }

  if (
    node instanceof NodePrefixUnaryExpression
    && node.operand instanceof NodeNumericLiteral
    && (node.operator === ast.SyntaxKind.MinusToken || node.operator === ast.SyntaxKind.PlusToken)
  ) {
    return parseNumericLiteral(node.operand.getText(), node.operator === ast.SyntaxKind.MinusToken);
  }

  return undefined;
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
  const variable = {
    value: cModuleLocalVariableName(moduleId, ++context.localCount, cName(identifier)),
    type: sscTypeName(context, identifier.getType()),
  };

  context.names.set(identifier.getSymbol().id, variable);

  return variable;
}

/**
 * 식별자를 값으로 읽는다. 유니온에 담긴 변수를 TS가 멤버 하나로 좁혔으면 그 멤버인지 확인하며
 * 꺼낸다. 좁혔는지는 TS가 본 타입이 아니라 C에 선언한 저장 타입과 비교해 정한다.
 */
function lowerIdentifier(node: NodeIdentifier, context: LowerContext) {
  const type = sscTypeName(context, node.getType());

  if (type === 'undefined' && !node.getSymbol().valueDeclaration) {
    return '(ssc__type__undefined){}';
  }

  const variable = findName(context, node);
  const members = unionMembersOf(variable.type);

  if (!members || unionMembersOf(type)) {
    return variable.value;
  }

  if (!members.includes(type)) {
    throw new Error(`${node.location()}: ${type} is not a member of ${variable.type}`);
  }

  return call(`ssc__fn__union_get_${type}`, [variable.value]);
}

/**
 * 유니온 값의 타입을 묻는 비교. `x === undefined`와 `typeof x === '...'`는 유니온의 타입 id로
 * 판정한다. 유니온이 아니면 타입이 정해져 있어 결과가 상수다.
 */
function lowerTypeCheck(node: NodeBinaryExpression, context: LowerContext) {
  const { left, right } = node;
  const typeOf =
    left instanceof NodeTypeOfExpression && right instanceof NodeStringLiteral ? { left, right }
    : right instanceof NodeTypeOfExpression && left instanceof NodeStringLiteral ?
      { left: right, right: left }
    : undefined;

  if (typeOf) {
    const { expression } = typeOf.left;
    const name = typeOf.right.value;
    const type = sscTypeName(context, expression.getType());

    // JS의 `typeof null`은 'object'다. 객체가 아직 없어 'object'는 null뿐이다.
    if (!unionMembersOf(type)) {
      const jsType =
        includes(sscNumberTypes, type) ? 'number'
        : type === 'null' ? 'object'
        : type;
      return String(jsType === name);
    }

    const member =
      name === 'object' ? 'null'
      : name === 'undefined' || name === 'boolean' || name === 'number' ? name
      : undefined;

    return member ?
        call(`ssc__fn__union_is_${member}`, [lowerExpression(expression, context)])
      : 'false';
  }

  const leftType = sscTypeName(context, left.getType());
  const rightType = sscTypeName(context, right.getType());
  const nullish =
    leftType === 'undefined' || leftType === 'null' ? leftType
    : rightType === 'undefined' || rightType === 'null' ? rightType
    : undefined;

  if (!nullish) {
    return undefined;
  }

  const [value, type] = nullish === leftType ? [right, rightType] : [left, leftType];

  if (!unionMembersOf(type)) {
    return String(type === nullish);
  }

  return call(`ssc__fn__union_is_${nullish}`, [lowerExpression(value, context)]);
}

/**
 * 식별자의 C lvalue. 지역 변수가 아니면 최상위 변수다. 선언 전에 접근될 수 있는 변수는 함수
 * 안에서만 검사한다. 최상위 코드는 선언 전에 쓰면 TS가 막는다(TS2448).
 */
function findName(context: LowerContext, identifier: NodeIdentifier): Variable {
  const id = identifier.getSymbol().id;
  const local = context.names.get(id);

  if (local) {
    return local;
  }

  const global = context.globals.get(id) || declareImportedGlobal(context, identifier, id);

  if (!global.tag || context.writer === context.initWriter) {
    return global;
  }

  return {
    value: `(*(ssc__fn__validate_tdz(${global.tag} == ${CTag.Value}, "${identifier.text}"), &${global.value}))`,
    type: global.type,
  };
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
  const global = {
    value,
    type: sscTypeName(context, declarationIdentifier.getType()),
    tag: undefined,
  };

  context.module.declare(value, `extern ${toCTypeName(global.type)} ${value}`);
  context.globals.set(id, global);

  return global;
}

/** `++`, `--`는 대입 대상 검사가 없어 뺀다. */
function lowerUpdate(
  node: NodePrefixUnaryExpression | NodePostfixUnaryExpression,
  context: LowerContext,
) {
  const { operand } = node;

  assert(operand instanceof NodeIdentifier, `${node.location()}: only identifier is assignable`);

  const type = numberTypeOf(operand, context);
  const { value: name, type: storage } = findName(context, operand);

  if (storage !== type) {
    throw new Error(`${node.location()}: update on ${storage} is not implemented`);
  }
  const isIncrement = node.operator === ast.SyntaxKind.PlusPlusToken;
  const isPrefix = node instanceof NodePrefixUnaryExpression;

  if (includes(sscFloatTypes, type)) {
    const operator = isIncrement ? '++' : '--';
    return isPrefix ? unary(operator, name) : `(${name}${operator})`;
  }

  const fn = `${isIncrement ? 'increment' : 'decrement'}_${isPrefix ? 'prefix' : 'postfix'}`;

  return call(`ssc__fn__${fn}_${type}`, [unary('&', name)]);
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
  [ast.SyntaxKind.AmpersandToken]: '&',
  [ast.SyntaxKind.BarToken]: '|',
  [ast.SyntaxKind.CaretToken]: '^',
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
  [ast.SyntaxKind.SlashEqualsToken]: '/=',
  [ast.SyntaxKind.PercentEqualsToken]: '%=',
  [ast.SyntaxKind.AmpersandEqualsToken]: '&=',
  [ast.SyntaxKind.BarEqualsToken]: '|=',
  [ast.SyntaxKind.CaretEqualsToken]: '^=',
} as const;

/** 유니온 멤버로 쓸 수 있는 타입. 유니온 이름의 멤버 순서도 이 순서다. */
const unionMemberTypes = ['undefined', 'null', 'boolean', ...sscNumberTypes] as const;

/** `union:boolean|i32`의 멤버. 유니온이 아니면 없다. */
function unionMembersOf(name: string) {
  return name.startsWith('union:') ? name.slice('union:'.length).split('|') : undefined;
}

function toCType(context: LowerContext, type: ts.Type) {
  return toCTypeName(sscTypeName(context, type));
}

/**
 * lower가 타입을 구분할 때 쓰는 이름. `boolean`은 `true | false` 유니온이라 유니온보다 먼저
 * 본다. `number`와 숫자 리터럴은 `f64`다. 나머지는 prelude에 선언된 타입 별칭이어야 한다.
 */
function sscTypeName(context: LowerContext, type: ts.Type): string {
  if (isTypeFlagMatch(type, ts.TypeFlags.BooleanLike)) {
    return 'boolean';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Void)) {
    return 'void';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Undefined)) {
    return 'undefined';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Null)) {
    return 'null';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return 'f64';
  }

  const { checker } = context.sourceFile.app;

  if (type.isUnionType()) {
    const members = new Set(type.getTypes().map((t) => sscTypeName(context, t)));
    const unsupported = members.values().find((m) => !includes(unionMemberTypes, m));

    if (unsupported) {
      throw new Error(`not implemented union member ${unsupported}: ${checker.typeToString(type)}`);
    }

    const [first, ...rest] = unionMemberTypes.filter((m) => members.has(m));

    assert(first, `empty union: ${checker.typeToString(type)}`);

    return rest.length ? `union:${[first, ...rest].join('|')}` : first;
  }

  const brand =
    type.isIntersectionType() ?
      type
        .getTypes()
        .find((t) => isTypeFlagMatch(t, ts.TypeFlags.Object))
        ?.getSymbol()
        ?.declarations[0]?.resolve()
    : undefined;
  const symbol = brand ? checker.getSymbolOfNode(brand.parent.parent) : undefined;

  assert(symbol, `not implemented type: ${checker.typeToString(type)}`);

  const declarationFile = symbol.declarations[0]?.resolve()?.getSourceFile();

  assert(declarationFile, `declaration not found: ${symbol.name}`);

  const realPath = context.sourceFile.app.parser.tsPathToRealPath(declarationFile.fileName);

  if (realPath !== context.prelude.realPath) {
    throw new Error(`'${symbol.name}' is not the prelude type, it is declared in ${realPath}`);
  }

  return symbol.name;
}
