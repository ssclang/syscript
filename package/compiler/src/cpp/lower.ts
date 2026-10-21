import { assert, assertNever } from '@syscript/share/util';
import BigNumber from 'bignumber.js';
import * as ast from 'typescript7/ast';
import * as ts from 'typescript7/sync';
import { CppWriter } from '~/cpp/writer.js';
import { includes, sscFloatTypes, SscNumberType, sscNumberTypes } from '~/ssc/type.js';
import {
  commonType,
  CommonTypeOperand,
  isLiteralInRange,
  isLossless,
  sortedTypes,
} from '~/ts/common-type.js';
import {
  AbstractNode,
  AbstractStatement,
  AppSourceFile,
  isTypeFlagMatch,
  NodeBinaryExpression,
  NodeBlock,
  NodeBooleanLiteral,
  NodeCallExpression,
  NodeExpressionStatement,
  NodeFunctionDeclaration,
  NodeIdentifier,
  NodeIfStatement,
  NodeImportDeclaration,
  NodeNullLiteral,
  NodeNumericLiteral,
  NodeParenthesizedExpression,
  NodeReturnStatement,
  NodeVariableDeclaration,
  NodeVariableStatement,
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
      addAssignment(getSscVariableName(identifier.text), lowerExpression(d.initializer, context));
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
    return node.declarations.map((d) => {
      const { identifier } = d.bindingName;
      const constness = d.keyword === 'const' ? 'const ' : '';
      const signature = getVariableSignature(identifier);

      if (!d.initializer) {
        return `${constness}${signature};`;
      }

      return `${constness}${signature} = ${lowerExpression(d.initializer, context)};`;
    });
  }

  if (node instanceof NodeReturnStatement) {
    const line =
      node.expression ? `return ${lowerExpression(node.expression, context)};` : 'return;';
    return [line];
  }

  throw new Error(`not implemented statement: ${node.getText()}`);
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

function lowerCondition(node: AbstractNode<ast.Expression>, context: LowerContext) {
  const typeName = getSscTypeName(node.app, node.getType());
  const text = lowerExpression(node, context);

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

  if (node instanceof NodeNumericLiteral) {
    const type = node.getContextualType() || node.getType();

    if (!type.isUnionType()) {
      return getNumericLiteral(node.value, getSscTypeName(node.app, type));
    }

    const memberTypeNames = type.getTypes().map((t) => getSscTypeName(node.app, t));
    const memberType = sortedTypes.find((t) => {
      return (
        memberTypeNames.includes(`ssc__core__type__${t}`)
        && isLiteralInRange(new BigNumber(node.value), t)
      );
    });

    assert(
      memberType,
      `${node.location()}: ${node.getText()} can not be put in ${node.app.checker.typeToString(type)}`,
    );

    return getNumericLiteral(node.value, `ssc__core__type__${memberType}`);
  }

  if (node instanceof NodeIdentifier) {
    if (node.app.checker.isUndefinedSymbol(node.getSymbol())) {
      return 'ssc__core__var__undefined';
    }

    return narrowUnion(node, lowerVariableReference(node, context));
  }

  if (node instanceof NodeBinaryExpression) {
    const { kind } = node.binaryOperatorToken;

    if (kind === ast.SyntaxKind.EqualsToken) {
      assert(
        node.left instanceof NodeIdentifier,
        `${node.location()}: not implemented assignment target: ${node.left.getText()}`,
      );

      return `(${lowerVariableReference(node.left, context)} = ${lowerExpression(node.right, context)})`;
    }

    if (
      kind === ast.SyntaxKind.PlusToken
      || kind === ast.SyntaxKind.MinusToken
      || kind === ast.SyntaxKind.AsteriskToken
      || kind === ast.SyntaxKind.SlashToken
      || kind === ast.SyntaxKind.PercentToken
    ) {
      return lowerArithmeticExpression(node, context);
    }

    if (
      kind === ast.SyntaxKind.LessThanToken
      || kind === ast.SyntaxKind.LessThanEqualsToken
      || kind === ast.SyntaxKind.GreaterThanToken
      || kind === ast.SyntaxKind.GreaterThanEqualsToken
      || kind === ast.SyntaxKind.EqualsEqualsEqualsToken
      || kind === ast.SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      return lowerComparisonExpression(node, context);
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

    if (ast.isFunctionDeclaration(declaration)) {
      const functionDeclaration = new NodeFunctionDeclaration(node.app, declaration);
      const namespaceName = getSscNamespaceName(pathToId(realPath));
      const functionName = getSscFunctionName(functionDeclaration);
      const args = node.arguments.map((a) => lowerExpression(a, context)).join(', ');

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

function lowerArithmeticExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;
  const type = getSscNumberType(node);
  const common = commonType([...getOperands(node.left), ...getOperands(node.right)]);

  assert(common === type, `${node.location()}: common type ${common} does not match ${type}`);

  const left = lowerNumber(node.left, type, context);
  const right = lowerNumber(node.right, type, context);

  if (type === 'f32' && kind === ast.SyntaxKind.PercentToken) {
    return `__builtin_fmodf(${left}, ${right})`;
  }

  if (type === 'f64' && kind === ast.SyntaxKind.PercentToken) {
    return `__builtin_fmod(${left}, ${right})`;
  }

  if (includes(sscFloatTypes, type)) {
    return `(${left} ${getArithmeticOperator(kind)} ${right})`;
  }

  return `ssc__core__fn__${getArithmeticFunctionName(kind)}(${left}, ${right}, "${type}")`;
}

function getArithmeticOperator(kind: ast.BinaryOperator) {
  if (kind === ast.SyntaxKind.PlusToken) {
    return '+';
  }

  if (kind === ast.SyntaxKind.MinusToken) {
    return '-';
  }

  if (kind === ast.SyntaxKind.AsteriskToken) {
    return '*';
  }

  if (kind === ast.SyntaxKind.SlashToken) {
    return '/';
  }

  assertNever(kind as never);
}

function getArithmeticFunctionName(kind: ast.BinaryOperator) {
  if (kind === ast.SyntaxKind.PlusToken) {
    return 'add';
  }

  if (kind === ast.SyntaxKind.MinusToken) {
    return 'sub';
  }

  if (kind === ast.SyntaxKind.AsteriskToken) {
    return 'mul';
  }

  if (kind === ast.SyntaxKind.SlashToken) {
    return 'div';
  }

  if (kind === ast.SyntaxKind.PercentToken) {
    return 'rem';
  }

  assertNever(kind as never);
}

function lowerComparisonExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;
  const type = commonType([...getOperands(node.left), ...getOperands(node.right)]);
  const left = lowerNumber(node.left, type, context);
  const right = lowerNumber(node.right, type, context);

  return `(${left} ${getComparisonOperator(kind)} ${right})`;
}

function getComparisonOperator(kind: ast.BinaryOperator) {
  if (kind === ast.SyntaxKind.LessThanToken) {
    return '<';
  }

  if (kind === ast.SyntaxKind.LessThanEqualsToken) {
    return '<=';
  }

  if (kind === ast.SyntaxKind.GreaterThanToken) {
    return '>';
  }

  if (kind === ast.SyntaxKind.GreaterThanEqualsToken) {
    return '>=';
  }

  if (kind === ast.SyntaxKind.EqualsEqualsEqualsToken) {
    return '==';
  }

  if (kind === ast.SyntaxKind.ExclamationEqualsEqualsToken) {
    return '!=';
  }

  assertNever(kind as never);
}

function getOperands(node: AbstractNode<ast.Expression>): CommonTypeOperand[] {
  const type = node.getType();
  const memberTypes = type.isUnionType() ? type.getTypes() : [type];

  return memberTypes.map((t) => {
    if (isTypeFlagMatch(t, ts.TypeFlags.NumberLiteral)) {
      return { literal: getNumberLiteralValue(node.app, t) };
    }

    return { type: getSscNumberType(node, t) };
  });
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

  if (isTypeFlagMatch(nodeType, ts.TypeFlags.NumberLiteral)) {
    const value = getNumberLiteralValue(node.app, nodeType);

    assert(
      isLiteralInRange(value, type),
      `${node.location()}: '${node.getText()}' can not be converted to ${type}`,
    );

    if (node instanceof NodeNumericLiteral) {
      return getNumericLiteral(value.toFixed(), `ssc__core__type__${type}`);
    }

    return `static_cast<ssc__core__type__${type}>(${lowerExpression(node, context)})`;
  }

  const text = lowerExpression(node, context);
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
    return 'ssc__core__var__undefined';
  }

  if (typeName === 'ssc__core__type__null') {
    return 'ssc__core__var__null';
  }

  return `${text}.ssc__core__member__value.${typeName.replace('ssc__core__type__', 'ssc__core__member__')}`;
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
    throw new Error(`not implemented char literal: ${value}`);
  }

  assertNever(type as never);
}
