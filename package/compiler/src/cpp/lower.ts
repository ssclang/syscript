import { assert, assertNever } from '@syscript/share/util';
import BigNumber from 'bignumber.js';
import * as ast from 'typescript7/ast';
import * as ts from 'typescript7/sync';
import { CppWriter } from '~/cpp/writer.js';
import { includes, sscFloatTypes, SscNumberType, sscNumberTypes } from '~/ssc/type.js';
import { commonType, CommonTypeOperand, isLiteralInRange, isLossless } from '~/ts/common-type.js';
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
  NodePropertyAccessExpression,
  NodePostfixUnaryExpression,
  NodePrefixUnaryExpression,
  NodeReturnStatement,
  NodeStringLiteral,
  NodeTypeOfExpression,
  NodeVariableDeclaration,
  NodeVariableStatement,
  NodeWhileStatement,
} from '~/ts/node.js';
import { RealPath } from '~/util/path.js';

export type ProgramContext = {
  kind: 'program';
  pathToId: (path: RealPath) => string;
  topLevelVariableSymbolIdSet: Set<number>;
  tdzVariableSymbolIdSet: Set<number>;
  tdzReferenceNodeSet: Set<ast.Node>;
};

type LowerContext = TopLevelContext | FunctionContext;

type GlobalContext = {
  kind: 'global';
  programContext: ProgramContext;
  importedForwardMap: Map<RealPath, Map<string, string>>;
};

type TopLevelContext = {
  kind: 'topLevel';
  globalContext: GlobalContext;
};

type FunctionContext = {
  kind: 'function';
  globalContext: GlobalContext;
};

export function lower(sourceFile: AppSourceFile, programContext: ProgramContext) {
  assert(
    !sourceFile.isDeclarationFile,
    `declaration file can not be lowered: ${sourceFile.realPath}`,
  );

  const { pathToId, tdzVariableSymbolIdSet } = programContext;
  const globalContext = {
    kind: 'global',
    programContext,
    importedForwardMap: new Map<RealPath, Map<string, string>>(),
  } as const satisfies GlobalContext;
  const topLevelContext = { kind: 'topLevel', globalContext } as const satisfies TopLevelContext;
  const pathId = pathToId(sourceFile.realPath);
  const namespaceName = getSscNamespaceName(pathId);
  const topLevelVariableDefinitions = sourceFile.statements
    .values()
    .filter((s) => s instanceof NodeVariableStatement)
    .flatMap((s) => s.declarations)
    .flatMap((d) => {
      const { identifier } = d.bindingName;
      const symbolId = identifier.getSymbol().id;
      const linkage = getVariableLinkage(d);
      const definitions = [`${linkage}${getVariableSignature(identifier)};`];

      if (tdzVariableSymbolIdSet.has(symbolId)) {
        const tdzDefinition = `${linkage}ssc__core__type__boolean ${getSscTdzTagName(identifier.text)};`;
        definitions.push(tdzDefinition);
      }

      return definitions;
    })
    .toArray();
  const functions = sourceFile.statements.filter((n) => n instanceof NodeFunctionDeclaration);
  const functionForwards = functions.map((f) => `${getFunctionSignature(f)};`);
  const definedFunctionLines = functions
    .filter((f) => !f.isDeclared)
    .flatMap((f) => lowerFunction(f, topLevelContext));
  const topLevelStatements = lowerTopLevelStatements(sourceFile, topLevelContext);
  const w = new CppWriter();

  w.inline('module ts;');
  w.newline();
  w.newline('import ssc;');
  w.newline();
  w.newline();

  for (const entry of globalContext.importedForwardMap) {
    const [realPath, forwards] = entry;

    w.block(`namespace ${getSscNamespaceName(pathToId(realPath))}`, () =>
      forwards.values().toArray(),
    );
    w.newline();
    w.newline();
  }

  w.block(`namespace ${namespaceName}`, () => [
    ...topLevelVariableDefinitions,
    ...functionForwards,
    ...definedFunctionLines,
    ...topLevelStatements,
  ]);

  return {
    render: () => w.code(),
    code: () => w.code(),
    lines: () => w.lines(),
  };
}

export function renderTsCppm(pathIds: readonly string[]) {
  const w = new CppWriter();

  w.inline('export module ts;');
  w.newline();

  for (const pathId of pathIds) {
    w.newline();
    w.block(`export namespace ${getSscNamespaceName(pathId)}`, () => [
      `void ${getSscTopLevelStatementsInitFunctionName(pathId)}();`,
    ]);
  }

  return w.code();
}

export function renderMainCpp(pathIds: readonly string[]) {
  const w = new CppWriter();

  w.inline('import std;');
  w.newline('import ssc;');
  w.newline('import ts;');
  w.newline();
  w.newline();
  w.block('int main()', () => {
    const mainBlock = new CppWriter();

    mainBlock.block('try', () =>
      pathIds.map(
        (id) => `${getSscNamespaceName(id)}::${getSscTopLevelStatementsInitFunctionName(id)}();`,
      ),
    );
    mainBlock.block(' catch (const std::string& message)', () => [
      'ssc__core__fn__write_stderr(message + "\\n");',
      'return 1;',
    ]);

    return [...mainBlock.lines(), 'return 0;'];
  });

  return w.code();
}

function getSscNamespaceName(pathId: string) {
  return `ssc__ts__namespace__${pathId}`;
}

function getSscTopLevelStatementsInitFunctionName(pathId: string) {
  return `ssc__core__fn__${pathId}`;
}

function getSscVariableName(name: string) {
  return `ssc__ts__var__${name}`;
}

function getSscFunctionName(node: NodeFunctionDeclaration) {
  const name = node.identifier.text;

  if (node.isDeclared) {
    return name;
  }

  return `ssc__ts__fn__${name}`;
}

function getSscTdzTagName(name: string) {
  return `ssc__ts__tdz__${name}`;
}

function getVariableSignature(identifier: NodeIdentifier) {
  return `${getSscTypeName(identifier.app, identifier.getType())} ${getSscVariableName(identifier.text)}`;
}

function getFunctionSignature(node: NodeFunctionDeclaration) {
  const linkage = getFunctionLinkage(node);
  const returnType = getSscTypeName(node.app, node.getReturnType());
  const parameters = node.parameters
    .map((p) => getVariableSignature(p.bindingName.identifier))
    .join(', ');

  return `${linkage}${returnType} ${getSscFunctionName(node)}(${parameters})`;
}

function getVariableLinkage(node: NodeVariableDeclaration) {
  if (node.isExported) {
    return '';
  }

  return 'static ';
}

function getFunctionLinkage(node: NodeFunctionDeclaration) {
  if (node.isDeclared) {
    return 'extern "C" ';
  }

  if (node.isExported) {
    return '';
  }

  return 'static ';
}

function lowerFunction(node: NodeFunctionDeclaration, topLevelContext: TopLevelContext) {
  assert(!node.isDeclared, `${node.location()}: declared function can not be lowered`);

  const context = {
    kind: 'function',
    globalContext: topLevelContext.globalContext,
  } as const satisfies FunctionContext;
  const w = new CppWriter();

  w.block(getFunctionSignature(node), () => {
    assert(node.block); // TODO: remove
    return node.block.statements
      .values()
      .flatMap((s) => lowerStatement(s, context))
      .toArray();
  });

  return w.lines();
}

function lowerTopLevelStatements(sourceFile: AppSourceFile, context: TopLevelContext) {
  const { pathToId } = context.globalContext.programContext;
  const pathId = pathToId(sourceFile.realPath);
  const w = new CppWriter();

  w.block(`void ${getSscTopLevelStatementsInitFunctionName(pathId)}()`, () => {
    return sourceFile.statements
      .values()
      .filter(
        (s) => !(s instanceof NodeFunctionDeclaration) && !(s instanceof NodeImportDeclaration),
      )
      .flatMap((s) => {
        if (s instanceof NodeVariableStatement) {
          return lowerTopLevelVariableStatement(s, context);
        }

        return lowerStatement(s, context);
      })
      .toArray();
  });

  return w.lines();
}

function lowerTopLevelVariableStatement(node: NodeVariableStatement, context: TopLevelContext) {
  return node.declarations.flatMap((d) => {
    const { identifier } = d.bindingName;
    const { pathToId, tdzVariableSymbolIdSet } = context.globalContext.programContext;
    const realPath = identifier.app.parser.tsPathToRealPath(identifier.getSourceFile().fileName);
    const namespaceName = getSscNamespaceName(pathToId(realPath));
    const lines: string[] = [];

    const addAssignment = (left: string, right: string) => {
      lines.push(`${namespaceName}::${left} = ${right};`);
    };

    if (d.initializer) {
      addAssignment(getSscVariableName(identifier.text), lowerValue(d.initializer, context));
    }

    if (tdzVariableSymbolIdSet.has(identifier.getSymbol().id)) {
      addAssignment(getSscTdzTagName(identifier.text), 'true');
    }

    return lines;
  });
}

function lowerStatement(node: AbstractStatement, context: LowerContext) {
  if (node instanceof NodeExpressionStatement) {
    return [`${lowerExpression(node.expression, context)};`];
  }

  if (node instanceof NodeIfStatement) {
    return lowerIfStatement(node, context);
  }

  if (node instanceof NodeVariableStatement) {
    return node.declarations.map((d) => `${lowerVariableDeclaration(d, context)};`);
  }

  if (node instanceof NodeReturnStatement) {
    const line = node.expression ? `return ${lowerValue(node.expression, context)};` : 'return;';
    return [line];
  }

  if (node instanceof NodeBlock) {
    const w = new CppWriter();

    w.block('', () => node.statements.flatMap((s) => lowerStatement(s, context)));

    return w.lines();
  }

  if (node instanceof NodeForStatement) {
    return lowerForStatement(node, context);
  }

  if (node instanceof NodeWhileStatement) {
    return lowerWhileStatement(node, context);
  }

  if (node instanceof NodeBreakStatement) {
    return ['break;'];
  }

  if (node instanceof NodeContinueStatement) {
    return ['continue;'];
  }

  throw new Error(`not implemented statement: ${node.getText()}`);
}

function lowerVariableDeclaration(node: NodeVariableDeclaration, context: LowerContext) {
  const { identifier } = node.bindingName;
  const constness = node.keyword === 'const' ? 'const ' : '';
  const signature = getVariableSignature(identifier);

  if (!node.initializer) {
    return `${constness}${signature}`;
  }

  return `${constness}${signature} = ${lowerValue(node.initializer, context)}`;
}

function lowerIfStatement(node: NodeIfStatement, context: LowerContext) {
  const w = new CppWriter();

  const lowerBranch = (branch: NodeIfStatement, isElseIf: boolean) => {
    const { elseStatement } = branch;
    const keyword = isElseIf ? ' else if' : 'if';

    w.block(`${keyword} (${lowerCondition(branch.expression, context)})`, () =>
      branch.block.statements.flatMap((s) => lowerStatement(s, context)),
    );

    if (elseStatement instanceof NodeIfStatement) {
      lowerBranch(elseStatement, true);
      return;
    }

    if (elseStatement instanceof NodeBlock) {
      w.block(' else', () => elseStatement.statements.flatMap((s) => lowerStatement(s, context)));
    }
  };

  lowerBranch(node, false);

  return w.lines();
}

function lowerForStatement(node: NodeForStatement, context: LowerContext) {
  const declarations = node.declarations.map((d) => lowerVariableDeclaration(d, context));
  const condition = lowerCondition(node.condition, context);
  const incrementor = lowerExpression(node.incrementor, context);
  const lowerBody = () => node.block.statements.flatMap((s) => lowerStatement(s, context));
  const w = new CppWriter();

  if (declarations.length === 1) {
    w.block(`for (${declarations.join('')}; ${condition}; ${incrementor})`, lowerBody);

    return w.lines();
  }

  w.block('', () => {
    const forWriter = new CppWriter();

    forWriter.block(`for (; ${condition}; ${incrementor})`, lowerBody);

    return [...declarations.map((d) => `${d};`), ...forWriter.lines()];
  });

  return w.lines();
}

function lowerWhileStatement(node: NodeWhileStatement, context: LowerContext) {
  const w = new CppWriter();

  w.block(`while (${lowerCondition(node.expression, context)})`, () =>
    node.block.statements.flatMap((s) => lowerStatement(s, context)),
  );

  return w.lines();
}

function lowerCondition(node: AbstractNode<ast.Expression>, context: LowerContext) {
  const typeName = getSscTypeName(node.app, node.getType());
  const text = lowerExpression(node, context);

  if (isStringType(node.getType())) {
    return `ssc__core__fn__string_length(${text}) != 0`;
  }

  return getTruthyCondition(typeName, text);
}

function getTruthyCondition(typeName: string, text: string) {
  if (typeName === 'ssc__core__type__union') {
    return `ssc__core__fn__truthy_union(${text})`;
  }

  if (typeName === 'ssc__core__type__boolean') {
    return text;
  }

  if (typeName === 'ssc__core__type__f32') {
    return `ssc__core__fn__truthy_f32(${text})`;
  }

  if (typeName === 'ssc__core__type__f64') {
    return `ssc__core__fn__truthy_f64(${text})`;
  }

  if (
    typeName === 'ssc__core__type__i8'
    || typeName === 'ssc__core__type__i16'
    || typeName === 'ssc__core__type__i32'
    || typeName === 'ssc__core__type__i64'
    || typeName === 'ssc__core__type__u8'
    || typeName === 'ssc__core__type__u16'
    || typeName === 'ssc__core__type__u32'
    || typeName === 'ssc__core__type__u64'
    || typeName === 'ssc__core__type__char'
  ) {
    return `${text} != 0`;
  }

  assertNever(typeName as never);
}

function lowerExpression(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  const { pathToId } = context.globalContext.programContext;

  if (node instanceof NodeBooleanLiteral) {
    return node.value.toString();
  }

  if (node instanceof NodeNullLiteral) {
    return 'ssc__core__var__null';
  }

  if (node instanceof NodeParenthesizedExpression) {
    return `(${lowerExpression(node.expression, context)})`;
  }

  if (isEffectiveNumericLiteral(node)) {
    const bigNumber = getNumberLiteralValue(node.app, node.getType());
    const value = bigNumber.toFixed();
    const type = node.app.checker.getContextualType(node.tsNode) || node.getType();

    if (!type.isUnionType()) {
      return getNumericLiteral(value, getSscTypeName(node.app, type));
    }

    return getNumericLiteral(
      value,
      `ssc__core__type__${getUnionNumberLiteralStorageType(bigNumber)}`,
    );
  }

  if (node instanceof NodeStringLiteral) {
    return getStringLiteral(node.value);
  }

  if (node instanceof NodePropertyAccessExpression) {
    return lowerPropertyAccessExpression(node, context);
  }

  if (node instanceof NodeTypeOfExpression) {
    return lowerTypeOfExpression(node, context);
  }

  if (node instanceof NodePrefixUnaryExpression) {
    return lowerPrefixUnaryExpression(node, context);
  }

  if (node instanceof NodePostfixUnaryExpression) {
    return lowerPostfixUnaryExpression(node, context);
  }

  if (node instanceof NodeIdentifier) {
    if (node.app.checker.isUndefinedSymbol(node.getSymbol())) {
      return 'ssc__core__var__undefined';
    }

    return narrowUnion(node, lowerVariableReference(node, context));
  }

  if (node instanceof NodeBinaryExpression) {
    const { kind } = node.binaryOperatorToken;

    // =
    if (kind === ast.SyntaxKind.EqualsToken) {
      assert(
        node.left instanceof NodeIdentifier,
        `${node.location()}: not implemented assignment target: ${node.left.getText()}`,
      );

      return `(${lowerVariableReference(node.left, context)} = ${lowerValue(node.right, context)})`;
    }

    if (
      kind === ast.SyntaxKind.PlusToken // +
      || kind === ast.SyntaxKind.MinusToken // -
      || kind === ast.SyntaxKind.AsteriskToken // *
      || kind === ast.SyntaxKind.SlashToken // /
      || kind === ast.SyntaxKind.PercentToken // %
      || kind === ast.SyntaxKind.AmpersandToken // &
      || kind === ast.SyntaxKind.BarToken // |
      || kind === ast.SyntaxKind.CaretToken // ^
      || kind === ast.SyntaxKind.LessThanLessThanToken // <<
      || kind === ast.SyntaxKind.GreaterThanGreaterThanToken // >>
      || kind === ast.SyntaxKind.GreaterThanGreaterThanGreaterThanToken // >>>
    ) {
      return lowerArithmeticExpression(node, context);
    }

    if (
      kind === ast.SyntaxKind.LessThanToken // <
      || kind === ast.SyntaxKind.LessThanEqualsToken // <=
      || kind === ast.SyntaxKind.GreaterThanToken // >
      || kind === ast.SyntaxKind.GreaterThanEqualsToken // >=
      || kind === ast.SyntaxKind.EqualsEqualsEqualsToken // ===
      || kind === ast.SyntaxKind.ExclamationEqualsEqualsToken // !==
    ) {
      return lowerComparisonExpression(node, context);
    }

    if (
      kind === ast.SyntaxKind.AmpersandAmpersandToken // &&
      || kind === ast.SyntaxKind.BarBarToken // ||
    ) {
      return lowerLogicalExpression(node, context);
    }

    if (
      kind === ast.SyntaxKind.PlusEqualsToken // +=
      || kind === ast.SyntaxKind.MinusEqualsToken // -=
      || kind === ast.SyntaxKind.AsteriskEqualsToken // *=
      || kind === ast.SyntaxKind.SlashEqualsToken // /=
      || kind === ast.SyntaxKind.PercentEqualsToken // %=
      || kind === ast.SyntaxKind.AmpersandEqualsToken // &=
      || kind === ast.SyntaxKind.BarEqualsToken // |=
      || kind === ast.SyntaxKind.CaretEqualsToken // ^=
      || kind === ast.SyntaxKind.LessThanLessThanEqualsToken // <<=
      || kind === ast.SyntaxKind.GreaterThanGreaterThanEqualsToken // >>=
      || kind === ast.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken // >>>=
    ) {
      return lowerCompoundAssignmentExpression(node, context);
    }

    assertNever(kind as never);
  }

  if (node instanceof NodeCallExpression) {
    const callee = node.expression;

    assert(
      callee instanceof NodeIdentifier,
      `${callee.location()}: not implemented callee: ${callee.getText()}`,
    );

    const declaration = callee.getValueDeclaration();
    const realPath = node.app.parser.tsPathToRealPath(declaration.getSourceFile().fileName);
    const isSameFile = declaration.getSourceFile().fileName === node.getSourceFile().fileName;

    if (realPath === node.app.preludeSourceFile.realPath) {
      return lowerPreludeCallExpression(node, callee.text, context);
    }

    if (ast.isFunctionDeclaration(declaration)) {
      const functionDeclaration = new NodeFunctionDeclaration(node.app, declaration);
      const namespaceName = getSscNamespaceName(pathToId(realPath));
      const functionName = getSscFunctionName(functionDeclaration);
      const args = node.arguments.map((a) => lowerValue(a, context)).join(', ');

      if (!isSameFile) {
        assert(
          functionDeclaration.isExported,
          `${callee.location()}: '${callee.text}' is declared in ${realPath}, but it has no 'export' modifier`,
        );
        assert(
          !declaration.getSourceFile().isDeclarationFile || functionDeclaration.isDeclared,
          `${callee.location()}: '${callee.text}' is declared in ${realPath}, but it has no 'declare' modifier`,
        );

        addImportedForward(
          context,
          realPath,
          functionName,
          `${getFunctionSignature(functionDeclaration)};`,
        );
      }

      return `${namespaceName}::${functionName}(${args})`;
    }

    throw new Error(`${callee.location()}: not implemented callee: ${callee.text}`);
  }

  throw new Error(`not implemented expression: ${node.getText()}`);
}

function lowerPreludeCallExpression(node: NodeCallExpression, name: string, context: LowerContext) {
  const [argument] = node.arguments;

  assert(argument, `${node.location()}: '${name}' takes an argument`);

  if (
    name === 'i8'
    || name === 'i16'
    || name === 'i32'
    || name === 'i64'
    || name === 'u8'
    || name === 'u16'
    || name === 'u32'
    || name === 'u64'
    || name === 'f32'
    || name === 'f64'
  ) {
    return lowerNumber(argument, name, context);
  }

  if (name === 'char') {
    return `ssc__core__fn__char(${lowerNumber(argument, 'u32', context)})`;
  }

  if (name === 'addWrap' || name === 'subWrap' || name === 'mulWrap') {
    const [, right] = node.arguments;

    assert(right, `${node.location()}: '${name}' takes two arguments`);

    const type = getSscNumberType(node);
    const functionName = getSscWrappingArithmeticFunctionName(name);

    return `ssc__core__fn__${functionName}(${lowerNumber(argument, type, context)}, ${lowerNumber(right, type, context)})`;
  }

  throw new Error(`${node.location()}: not implemented prelude function: ${name}`);
}

function getSscWrappingArithmeticFunctionName(name: 'addWrap' | 'subWrap' | 'mulWrap') {
  if (name === 'addWrap') {
    return 'add_wrap';
  }

  if (name === 'subWrap') {
    return 'sub_wrap';
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (name === 'mulWrap') {
    return 'mul_wrap';
  }

  assertNever(name);
}

function lowerPrefixUnaryExpression(node: NodePrefixUnaryExpression, context: LowerContext) {
  const { operator, operand } = node;

  // !
  if (operator === ast.SyntaxKind.ExclamationToken) {
    return `(!(${lowerCondition(operand, context)}))`;
  }

  // -
  if (operator === ast.SyntaxKind.MinusToken) {
    const type = getSscNumberType(node);
    const text = lowerNumber(operand, type, context);

    if (includes(sscFloatTypes, type)) {
      return `(-${text})`;
    }

    const zero = getNumericLiteral('0', `ssc__core__type__${type}`);

    return `ssc__core__fn__sub(${zero}, ${text}, "${type}")`;
  }

  // +
  if (operator === ast.SyntaxKind.PlusToken) {
    return lowerNumber(operand, getSscNumberType(node), context);
  }

  // ~
  if (operator === ast.SyntaxKind.TildeToken) {
    return `ssc__core__fn__bitwise_not(${lowerNumber(operand, getSscNumberType(node), context)})`;
  }

  // ++ --
  return lowerUpdateExpression(node, context);
}

function lowerPostfixUnaryExpression(node: NodePostfixUnaryExpression, context: LowerContext) {
  // ++ --
  return lowerUpdateExpression(node, context);
}

function isEffectiveNumericLiteral(node: AbstractNode<ast.Expression>) {
  if (node instanceof NodeNumericLiteral) {
    return true;
  }

  return (
    node instanceof NodePrefixUnaryExpression
    && (node.operator === ast.SyntaxKind.MinusToken || node.operator === ast.SyntaxKind.PlusToken)
    && node.operand instanceof NodeNumericLiteral
  );
}

function lowerCompoundAssignmentExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;

  assert(
    node.left instanceof NodeIdentifier,
    `${node.location()}: not implemented assignment target: ${node.left.getText()}`,
  );

  if (isStringType(node.left.getType())) {
    const target = lowerVariableReference(node.left, context);

    return `(${target} = ssc__core__fn__string_concat(${target}, ${lowerString(node.right, context)}))`;
  }

  const type = getSscNumberType(node.left);
  const common = commonType([...getOperands(node.left), ...getOperands(node.right)]);

  assert(common === type, `${node.location()}: common type ${common} does not match ${type}`);

  const target = lowerVariableReference(node.left, context);
  const right = lowerNumber(node.right, type, context);
  const operator = getCompoundAssignmentOperator(kind);

  return `(${target} = ${getArithmeticText(operator, type, target, right)})`;
}

function getCompoundAssignmentOperator(kind: ast.BinaryOperator) {
  // +=
  if (kind === ast.SyntaxKind.PlusEqualsToken) {
    return ast.SyntaxKind.PlusToken;
  }

  // -=
  if (kind === ast.SyntaxKind.MinusEqualsToken) {
    return ast.SyntaxKind.MinusToken;
  }

  // *=
  if (kind === ast.SyntaxKind.AsteriskEqualsToken) {
    return ast.SyntaxKind.AsteriskToken;
  }

  // /=
  if (kind === ast.SyntaxKind.SlashEqualsToken) {
    return ast.SyntaxKind.SlashToken;
  }

  // %=
  if (kind === ast.SyntaxKind.PercentEqualsToken) {
    return ast.SyntaxKind.PercentToken;
  }

  // &=
  if (kind === ast.SyntaxKind.AmpersandEqualsToken) {
    return ast.SyntaxKind.AmpersandToken;
  }

  // |=
  if (kind === ast.SyntaxKind.BarEqualsToken) {
    return ast.SyntaxKind.BarToken;
  }

  // ^=
  if (kind === ast.SyntaxKind.CaretEqualsToken) {
    return ast.SyntaxKind.CaretToken;
  }

  // <<=
  if (kind === ast.SyntaxKind.LessThanLessThanEqualsToken) {
    return ast.SyntaxKind.LessThanLessThanToken;
  }

  // >>=
  if (kind === ast.SyntaxKind.GreaterThanGreaterThanEqualsToken) {
    return ast.SyntaxKind.GreaterThanGreaterThanToken;
  }

  // >>>=
  if (kind === ast.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken) {
    return ast.SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
  }

  assertNever(kind as never);
}

function lowerUpdateExpression(
  node: NodePrefixUnaryExpression | NodePostfixUnaryExpression,
  context: LowerContext,
) {
  const { operator, operand } = node;

  assert(
    operand instanceof NodeIdentifier,
    `${node.location()}: not implemented assignment target: ${operand.getText()}`,
  );

  const type = getSscNumberType(operand);
  const target = lowerVariableReference(operand, context);
  const isPrefix = node instanceof NodePrefixUnaryExpression;
  const isIncrement = operator === ast.SyntaxKind.PlusPlusToken;

  if (includes(sscFloatTypes, type)) {
    const text = isIncrement ? '++' : '--';

    return isPrefix ? `(${text}${target})` : `(${target}${text})`;
  }

  const name = `${isIncrement ? 'increment' : 'decrement'}_${isPrefix ? 'prefix' : 'postfix'}`;

  return `ssc__core__fn__${name}(${target}, "${type}")`;
}

function lowerArithmeticExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;

  if (isStringType(node.getType())) {
    return `ssc__core__fn__string_concat(${lowerString(node.left, context)}, ${lowerString(node.right, context)})`;
  }
  const type = getSscNumberType(node);
  const common = commonType([...getOperands(node.left), ...getOperands(node.right)]);

  assert(common === type, `${node.location()}: common type ${common} does not match ${type}`);

  const left = lowerNumber(node.left, type, context);
  const right = lowerNumber(node.right, type, context);

  return getArithmeticText(kind, type, left, right);
}

function getArithmeticText(
  kind: ast.BinaryOperator,
  type: SscNumberType,
  left: string,
  right: string,
) {
  // %
  if (type === 'f32' && kind === ast.SyntaxKind.PercentToken) {
    return `__builtin_fmodf(${left}, ${right})`;
  }

  // %
  if (type === 'f64' && kind === ast.SyntaxKind.PercentToken) {
    return `__builtin_fmod(${left}, ${right})`;
  }

  if (includes(sscFloatTypes, type)) {
    return `(${left} ${getArithmeticOperator(kind)} ${right})`;
  }

  if (
    kind === ast.SyntaxKind.AmpersandToken // &
    || kind === ast.SyntaxKind.BarToken // |
    || kind === ast.SyntaxKind.CaretToken // ^
  ) {
    return `ssc__core__fn__${getArithmeticFunctionName(kind)}(${left}, ${right})`;
  }

  return `ssc__core__fn__${getArithmeticFunctionName(kind)}(${left}, ${right}, "${type}")`;
}

function getArithmeticOperator(kind: ast.BinaryOperator) {
  // +
  if (kind === ast.SyntaxKind.PlusToken) {
    return '+';
  }

  // -
  if (kind === ast.SyntaxKind.MinusToken) {
    return '-';
  }

  // *
  if (kind === ast.SyntaxKind.AsteriskToken) {
    return '*';
  }

  // /
  if (kind === ast.SyntaxKind.SlashToken) {
    return '/';
  }

  assertNever(kind as never);
}

function getArithmeticFunctionName(kind: ast.BinaryOperator) {
  // +
  if (kind === ast.SyntaxKind.PlusToken) {
    return 'add';
  }

  // -
  if (kind === ast.SyntaxKind.MinusToken) {
    return 'sub';
  }

  // *
  if (kind === ast.SyntaxKind.AsteriskToken) {
    return 'mul';
  }

  // /
  if (kind === ast.SyntaxKind.SlashToken) {
    return 'div';
  }

  // %
  if (kind === ast.SyntaxKind.PercentToken) {
    return 'rem';
  }

  // &
  if (kind === ast.SyntaxKind.AmpersandToken) {
    return 'bitwise_and';
  }

  // |
  if (kind === ast.SyntaxKind.BarToken) {
    return 'bitwise_or';
  }

  // ^
  if (kind === ast.SyntaxKind.CaretToken) {
    return 'bitwise_xor';
  }

  // <<
  if (kind === ast.SyntaxKind.LessThanLessThanToken) {
    return 'shift_left';
  }

  // >>
  if (kind === ast.SyntaxKind.GreaterThanGreaterThanToken) {
    return 'shift_right';
  }

  // >>>
  if (kind === ast.SyntaxKind.GreaterThanGreaterThanGreaterThanToken) {
    return 'unsigned_shift_right';
  }

  assertNever(kind as never);
}

function lowerLogicalExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;
  const typeName = getSscTypeName(node.app, node.getType());

  if (typeName === 'ssc__core__type__boolean') {
    const left = lowerExpression(node.left, context);
    const right = lowerExpression(node.right, context);

    return `(${left} ${getLogicalOperator(kind)} ${right})`;
  }

  assert(
    typeName !== 'ssc__core__type__union',
    `${node.location()}: not implemented logical operator with a union result: ${node.getText()}`,
  );

  const type = getSscNumberType(node);
  const left = lowerNumber(node.left, type, context);
  const right = lowerNumber(node.right, type, context);
  const condition = getTruthyCondition(typeName, 'left');

  // &&
  if (kind === ast.SyntaxKind.AmpersandAmpersandToken) {
    return `[&] { const ${typeName} left = ${left}; return ${condition} ? ${right} : left; }()`;
  }

  // ||
  if (kind === ast.SyntaxKind.BarBarToken) {
    return `[&] { const ${typeName} left = ${left}; return ${condition} ? left : ${right}; }()`;
  }

  assertNever(kind as never);
}

function getLogicalOperator(kind: ast.BinaryOperator) {
  // &&
  if (kind === ast.SyntaxKind.AmpersandAmpersandToken) {
    return '&&';
  }

  // ||
  if (kind === ast.SyntaxKind.BarBarToken) {
    return '||';
  }

  assertNever(kind as never);
}

function lowerString(node: AbstractNode<ast.Expression>, context: LowerContext) {
  if (
    getSscTypeName(node.app, node.getType()) === 'ssc__core__type__char'
    || isCharLiteralType(node.getType())
  ) {
    return `ssc__core__fn__string_from_char(${lowerNumber(node, 'char', context)})`;
  }

  assert(
    isStringType(node.getType()),
    `${node.location()}: not implemented string conversion: ${node.getText()}`,
  );

  return lowerExpression(node, context);
}

function lowerPropertyAccessExpression(node: NodePropertyAccessExpression, context: LowerContext) {
  if (isStringType(node.expression.getType()) && node.name === 'length') {
    return `ssc__core__fn__string_length(${lowerExpression(node.expression, context)})`;
  }

  throw new Error(`${node.location()}: not implemented property: ${node.getText()}`);
}

function lowerTypeOfExpression(node: NodeTypeOfExpression, context: LowerContext) {
  if (isStringType(node.expression.getType())) {
    return getStringLiteral('string');
  }

  const typeName = getSscTypeName(node.app, node.expression.getType());

  if (typeName === 'ssc__core__type__union') {
    return `ssc__core__fn__typeof(${lowerExpression(node.expression, context)})`;
  }

  return getStringLiteral(getJsTypeOf(typeName));
}

function getStringLiteral(value: string) {
  const bytes = new TextEncoder().encode(value);
  const text = Array.from(bytes, (byte) => {
    if (0x20 <= byte && byte < 0x7f && byte !== 0x22 && byte !== 0x5c && byte !== 0x3f) {
      return String.fromCharCode(byte);
    }

    return `\\${byte.toString(8).padStart(3, '0')}`;
  }).join('');

  return `ssc__core__fn__string_literal<u8"${text}">()`;
}

function getJsTypeOf(typeName: string) {
  if (typeName === 'ssc__core__type__undefined') {
    return 'undefined';
  }

  if (typeName === 'ssc__core__type__null') {
    return 'object';
  }

  if (typeName === 'ssc__core__type__boolean') {
    return 'boolean';
  }

  if (includes(sscNumberTypes, typeName.replace('ssc__core__type__', ''))) {
    return 'number';
  }

  throw new Error(`not implemented typeof: ${typeName}`);
}

function getUnionNumberLiteralStorageType(value: BigNumber) {
  if (isLiteralInRange(value, 'i64')) {
    return 'i64';
  }

  if (isLiteralInRange(value, 'u64')) {
    return 'u64';
  }

  return 'f64';
}

function lowerComparisonExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;

  // === !==
  if (
    kind === ast.SyntaxKind.EqualsEqualsEqualsToken
    || kind === ast.SyntaxKind.ExclamationEqualsEqualsToken
  ) {
    const equality = lowerEqualityExpression(node, context);

    return kind === ast.SyntaxKind.ExclamationEqualsEqualsToken ? `(!${equality})` : equality;
  }

  if (isStringType(node.left.getType()) && isStringType(node.right.getType())) {
    const left = lowerExpression(node.left, context);
    const right = lowerExpression(node.right, context);

    return `(ssc__core__fn__string_compare(${left}, ${right}) ${getComparisonOperator(kind)} 0)`;
  }

  const type = commonType([...getOperands(node.left), ...getOperands(node.right)]);
  const left = lowerNumber(node.left, type, context);
  const right = lowerNumber(node.right, type, context);

  return `(${left} ${getComparisonOperator(kind)} ${right})`;
}

function lowerEqualityExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { left, right } = node;

  if (isTypeIdComparison(left) || isTypeIdComparison(right)) {
    const leftText = lowerEqualityOperand(left, right, context);
    const rightText = lowerEqualityOperand(right, left, context);

    return `ssc__core__fn__strict_equals(${leftText}, ${rightText})`;
  }

  if (
    isTypeFlagMatch(left.getType(), ts.TypeFlags.BooleanLike)
    && isTypeFlagMatch(right.getType(), ts.TypeFlags.BooleanLike)
  ) {
    return `(${lowerExpression(left, context)} == ${lowerExpression(right, context)})`;
  }

  if (isStringType(left.getType()) && isStringType(right.getType())) {
    return `ssc__core__fn__string_equals(${lowerExpression(left, context)}, ${lowerExpression(right, context)})`;
  }

  const type = commonType([...getOperands(left), ...getOperands(right)]);

  return `(${lowerNumber(left, type, context)} == ${lowerNumber(right, type, context)})`;
}

function isTypeIdComparison(node: AbstractNode<ast.Expression>) {
  const type = node.getType();

  return (
    isTypeFlagMatch(type, ts.TypeFlags.Undefined | ts.TypeFlags.Null)
    || getSscTypeName(node.app, type) === 'ssc__core__type__union'
  );
}

function lowerEqualityOperand(
  node: AbstractNode<ast.Expression>,
  other: AbstractNode<ast.Expression>,
  context: LowerContext,
) {
  const otherType = other.getType();
  const hasCharMember =
    otherType.isUnionType()
    && otherType.getTypes().some((t) => getSscTypeName(node.app, t) === 'ssc__core__type__char');

  if (isCharLiteralType(node.getType()) && hasCharMember) {
    return lowerNumber(node, 'char', context);
  }

  return lowerExpression(node, context);
}

function getComparisonOperator(kind: ast.BinaryOperator) {
  // <
  if (kind === ast.SyntaxKind.LessThanToken) {
    return '<';
  }

  // <=
  if (kind === ast.SyntaxKind.LessThanEqualsToken) {
    return '<=';
  }

  // >
  if (kind === ast.SyntaxKind.GreaterThanToken) {
    return '>';
  }

  // >=
  if (kind === ast.SyntaxKind.GreaterThanEqualsToken) {
    return '>=';
  }

  // ===
  if (kind === ast.SyntaxKind.EqualsEqualsEqualsToken) {
    return '==';
  }

  // !==
  if (kind === ast.SyntaxKind.ExclamationEqualsEqualsToken) {
    return '!=';
  }

  assertNever(kind as never);
}

function getOperands(node: AbstractNode<ast.Expression>): CommonTypeOperand[] {
  const type = node.getType();
  const memberTypes = type.isUnionType() ? type.getTypes() : [type];

  return memberTypes.flatMap((t): CommonTypeOperand[] => {
    if (isCharLiteralType(t)) {
      return [];
    }

    if (isTypeFlagMatch(t, ts.TypeFlags.NumberLiteral)) {
      return [{ literal: getNumberLiteralValue(node.app, t) }];
    }

    return [{ type: getSscNumberType(node, t) }];
  });
}

function lowerValue(node: AbstractNode<ast.Expression>, context: LowerContext) {
  const targetType = node.app.checker.getContextualType(node.tsNode);

  if (!targetType) {
    return lowerExpression(node, context);
  }

  const targetTypeName = getSscTypeName(node.app, targetType);

  const type = targetTypeName.replace('ssc__core__type__', '');

  if (includes(sscNumberTypes, type)) {
    return lowerNumber(node, type, context);
  }

  return lowerExpression(node, context);
}

function lowerNumber(
  node: AbstractNode<ast.Expression>,
  type: SscNumberType,
  context: LowerContext,
): string {
  if (node instanceof NodeParenthesizedExpression) {
    return `(${lowerNumber(node.expression, type, context)})`;
  }

  const nodeType = node.getType();

  if (isCharLiteralType(nodeType)) {
    assert(
      node instanceof NodeStringLiteral,
      `${node.location()}: not implemented char literal expression: ${node.getText()}`,
    );
    assert(
      isLiteralInRange(nodeType.value, type),
      `${node.location()}: '${node.getText()}' can not be converted to ${type}`,
    );

    return getNumericLiteral(String(nodeType.value.codePointAt(0)), `ssc__core__type__${type}`);
  }

  if (isTypeFlagMatch(nodeType, ts.TypeFlags.NumberLiteral)) {
    const value = getNumberLiteralValue(node.app, nodeType);

    assert(
      isLiteralInRange(value, type),
      `${node.location()}: '${node.getText()}' can not be converted to ${type}`,
    );

    if (isEffectiveNumericLiteral(node)) {
      return getNumericLiteral(value.toFixed(), `ssc__core__type__${type}`);
    }

    return `static_cast<ssc__core__type__${type}>(${lowerExpression(node, context)})`;
  }

  const text = lowerExpression(node, context);

  if (getSscTypeName(node.app, nodeType) === 'ssc__core__type__union') {
    return `ssc__core__fn__union_to_number<ssc__core__type__${type}>(${text})`;
  }

  const source = getSscNumberType(node, nodeType);

  if (source === type) {
    return text;
  }

  assert(
    isLossless(source, type),
    `${node.location()}: ${source} can not be converted to ${type} without loss`,
  );

  return `static_cast<ssc__core__type__${type}>(${text})`;
}

function getNumberLiteralValue(app: AppSourceFile['app'], type: ts.Type) {
  const text = app.checker.typeToString(type);

  assert(isTypeFlagMatch(type, ts.TypeFlags.NumberLiteral), `not a number literal type: ${text}`);

  return new BigNumber(text);
}

function isCharLiteralType(type: ts.Type): type is ts.StringLiteralType {
  return (
    type.isStringLiteralType() && type.value.isWellFormed() && Array.from(type.value).length === 1
  );
}

function getSscNumberType(node: AbstractNode<ast.Expression>, type = node.getType()) {
  const name = getSscTypeName(node.app, type).replace('ssc__core__type__', '');

  assert(includes(sscNumberTypes, name), `${node.location()}: not implemented type: ${name}`);

  return name;
}

function addImportedForward(
  context: LowerContext,
  realPath: RealPath,
  name: string,
  forward: string,
) {
  const forwards =
    context.globalContext.importedForwardMap.get(realPath) || new Map<string, string>();

  forwards.set(name, forward);
  context.globalContext.importedForwardMap.set(realPath, forwards);
}

function lowerVariableReference(node: NodeIdentifier, context: LowerContext) {
  const { pathToId, topLevelVariableSymbolIdSet, tdzReferenceNodeSet } =
    context.globalContext.programContext;
  const declaration = node.getValueDeclaration();
  const isSameFile = declaration.getSourceFile().fileName === node.getSourceFile().fileName;

  assert(
    ast.isVariableOrParameterDeclaration(declaration),
    `${node.location()}: '${node.text}' is not a variable identifier`,
  );

  if (!topLevelVariableSymbolIdSet.has(node.getSymbol().id)) {
    return getSscVariableName(node.text);
  }

  if (!isSameFile) {
    declareImportedVariable(node, context);
  }

  assert(
    ast.isVariableDeclaration(declaration),
    `${node.location()}: '${node.text}' is not a top-level variable`,
  );
  assert(
    ast.isIdentifier(declaration.name),
    `${node.location()}: not implemented binding name: ${node.text}`,
  );

  const { text } = declaration.name;
  const realPath = node.app.parser.tsPathToRealPath(declaration.getSourceFile().fileName);
  const namespaceName = getSscNamespaceName(pathToId(realPath));
  const variableName = `${namespaceName}::${getSscVariableName(text)}`;

  if (!tdzReferenceNodeSet.has(node.tsNode)) {
    return variableName;
  }

  const tdzTagName = getSscTdzTagName(text);

  if (!isSameFile) {
    addImportedForward(
      context,
      realPath,
      tdzTagName,
      `extern ssc__core__type__boolean ${tdzTagName};`,
    );
  }

  return `(ssc__core__fn__throw_if_tdz(${namespaceName}::${tdzTagName}, "${node.text}"), ${variableName})`;
}

function declareImportedVariable(node: NodeIdentifier, context: LowerContext) {
  const declaration = node.getValueDeclaration();

  assert(
    !declaration.getSourceFile().isDeclarationFile,
    `${node.location()}: not implemented ambient variable: ${node.text}`,
  );
  assert(
    ast.isVariableDeclaration(declaration),
    `${node.location()}: '${node.text}' is not a top-level variable`,
  );

  const { identifier } = new NodeVariableDeclaration(node.app, declaration).bindingName;
  const realPath = node.app.parser.tsPathToRealPath(declaration.getSourceFile().fileName);

  addImportedForward(
    context,
    realPath,
    getSscVariableName(identifier.text),
    `extern ${getVariableSignature(identifier)};`,
  );
}

function narrowUnion(node: AbstractNode<ast.Expression>, text: string) {
  const declaredType = node.app.checker.getTypeOfSymbol(node.getSymbol());

  if (getSscTypeName(node.app, declaredType) !== 'ssc__core__type__union') {
    return text;
  }

  const typeName = getSscTypeName(node.app, node.getType());

  if (typeName === 'ssc__core__type__union') {
    return text;
  }

  if (typeName === 'ssc__core__type__undefined') {
    return `ssc__core__fn__union_to_undefined(${text})`;
  }

  if (typeName === 'ssc__core__type__null') {
    return `ssc__core__fn__union_to_null(${text})`;
  }

  if (includes(sscNumberTypes, typeName.replace('ssc__core__type__', ''))) {
    return `ssc__core__fn__union_to_number<${typeName}>(${text})`;
  }

  if (typeName === 'ssc__core__type__boolean') {
    return `ssc__core__fn__union_to_boolean(${text})`;
  }

  if (typeName === 'ssc__core__type__ref') {
    return `ssc__core__fn__union_to_ref(${text})`;
  }

  throw new Error(`${node.location()}: not implemented union member read: ${node.getText()}`);
}

function isStringType(type: ts.Type) {
  if (type.isUnionType()) {
    return type.getTypes().every((t) => isTypeFlagMatch(t, ts.TypeFlags.StringLike));
  }

  return isTypeFlagMatch(type, ts.TypeFlags.StringLike);
}

function getSscTypeName(app: AppSourceFile['app'], type: ts.Type): string {
  if (isTypeFlagMatch(type, ts.TypeFlags.Void)) {
    return 'void';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Undefined)) {
    return 'ssc__core__type__undefined';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Null)) {
    return 'ssc__core__type__null';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.BooleanLike)) {
    return 'ssc__core__type__boolean';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return 'ssc__core__type__f64';
  }

  if (isStringType(type)) {
    return 'ssc__core__type__ref';
  }

  // `boolean` is also a `true | false` union, so this must come after the BooleanLike check
  if (type.isUnionType()) {
    return 'ssc__core__type__union';
  }

  const { checker } = app;
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
  assert(app.parser.tsPathToRealPath(declarationFile.fileName) === app.preludeSourceFile.realPath);

  return `ssc__core__type__${symbol.name}`;
}

function getNumericLiteral(value: string, type: string) {
  if (
    type === 'ssc__core__type__i8'
    || type === 'ssc__core__type__i16'
    || type === 'ssc__core__type__i32'
    || type === 'ssc__core__type__i64'
  ) {
    if (value === '-9223372036854775808') {
      return `${type}{-9223372036854775807 - 1}`;
    }

    return `${type}{${value}}`;
  }

  if (
    type === 'ssc__core__type__u8'
    || type === 'ssc__core__type__u16'
    || type === 'ssc__core__type__u32'
    || type === 'ssc__core__type__u64'
  ) {
    return `${type}{${value}u}`;
  }

  if (type === 'ssc__core__type__f32' || type === 'ssc__core__type__f64') {
    const float = value.includes('.') ? value : `${value}.0`;
    const suffix = type === 'ssc__core__type__f32' ? 'f' : '';

    return `${type}{${float}${suffix}}`;
  }

  if (type === 'ssc__core__type__char') {
    return `${type}{${value}u}`;
  }

  assertNever(type as never);
}
