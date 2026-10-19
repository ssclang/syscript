import { assert, assertNever } from '@syscript/share/util';
import BigNumber from 'bignumber.js';
import * as ast from 'typescript7/ast';
import * as ts from 'typescript7/sync';
import { CppWriter } from '~/cpp/writer.js';
import { isLiteralInRange, sortedTypes } from '~/ts/common-type.js';
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
  NodeParameterDeclaration,
  NodeParenthesizedExpression,
  NodeReturnStatement,
  NodeVariableDeclaration,
  NodeVariableStatement,
} from '~/ts/node.js';
import { RealPath } from '~/util/path.js';

type LowerContext = {
  pathToId: (path: RealPath) => string;
  topLevelVariableMap: Map<number, string>;
  importedForwardMap: Map<RealPath, Map<string, string>>;
};

export function lower(sourceFile: AppSourceFile, pathToId: (path: RealPath) => string) {
  assert(
    !sourceFile.isDeclarationFile,
    `declaration file can not be lowered: ${sourceFile.realPath}`,
  );

  const context: LowerContext = {
    pathToId,
    topLevelVariableMap: new Map(),
    importedForwardMap: new Map(),
  };
  const pathId = pathToId(sourceFile.realPath);
  const namespaceName = getNamespaceName(pathId);

  const topLevelVariableDefinitions = sourceFile.statements
    .values()
    .filter((s) => s instanceof NodeVariableStatement)
    .flatMap((s) => s.declarations)
    .map((d) => {
      const { identifier } = d.bindingName;
      const linkage = d.isExported ? '' : 'static ';
      const name = getVariableName(identifier.text);

      context.topLevelVariableMap.set(identifier.getSymbol().id, `${namespaceName}::${name}`);

      return `${linkage}${getTypeName(d.app, identifier.getType())} ${name};`;
    })
    .toArray();

  const functions = sourceFile.statements.filter((n) => n instanceof NodeFunctionDeclaration);
  const functionForwards = functions.map((f) => `${getFunctionSignature(f)};`);
  const definedFunctionLines = functions
    .filter((f) => !f.isDeclared)
    .flatMap((f) => lowerFunction(f, context));
  const topLevelStatements = lowerTopLevelStatements(sourceFile, context);
  const w = new CppWriter();

  w.inline('module ts;');
  w.newline();
  w.newline('import ssc;');
  w.newline();
  w.newline();

  for (const entry of context.importedForwardMap) {
    const [realPath, forwards] = entry;

    w.block(`namespace ${getNamespaceName(pathToId(realPath))}`, () => forwards.values().toArray());
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
    w.block(`export namespace ${getNamespaceName(pathId)}`, () => [
      `void ${getTopLevelStatementsInitFunctionName(pathId)}();`,
    ]);
  }

  return w.code();
}

export function renderMainCpp(pathIds: readonly string[]) {
  const w = new CppWriter();

  w.inline('import ts;');
  w.newline();
  w.newline();
  w.block('int main()', () => [
    ...pathIds.map(
      (id) => `${getNamespaceName(id)}::${getTopLevelStatementsInitFunctionName(id)}();`,
    ),
    'return 0;',
  ]);

  return w.code();
}

function getNamespaceName(pathId: string) {
  return `ssc__ts__namespace__${pathId}`;
}

function getTopLevelStatementsInitFunctionName(pathId: string) {
  return `ssc__core__fn__${pathId}`;
}

function getFunctionName(node: NodeFunctionDeclaration) {
  const name = node.identifier.text;

  if (node.isDeclared) {
    return name;
  }

  return `ssc__ts__fn__${name}`;
}

function getVariableName(name: string) {
  return `ssc__ts__var__${name}`;
}

function getFunctionSignature(node: NodeFunctionDeclaration) {
  const linkage = getFunctionLinkage(node);
  const returnType = getTypeName(node.app, node.getReturnType());
  const parameters = node.parameters.map(lowerParameter).join(', ');

  return `${linkage}${returnType} ${getFunctionName(node)}(${parameters})`;
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

function lowerFunction(node: NodeFunctionDeclaration, context: LowerContext) {
  assert(!node.isDeclared, `${node.location()}: declared function can not be lowered`);

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

function lowerTopLevelStatements(sourceFile: AppSourceFile, context: LowerContext) {
  const { pathToId } = context;
  const pathId = pathToId(sourceFile.realPath);
  const w = new CppWriter();

  w.block(`void ${getTopLevelStatementsInitFunctionName(pathId)}()`, () => {
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

function lowerTopLevelVariableStatement(node: NodeVariableStatement, context: LowerContext) {
  return node.declarations.flatMap((d) => {
    if (!d.initializer) {
      return [];
    }

    const name = lowerVariableReference(d.bindingName.identifier, context);

    return [`${name} = ${lowerExpression(d.initializer, context)};`];
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
      const typeName = getTypeName(node.app, identifier.getType());
      const name = getVariableName(identifier.text);

      if (!d.initializer) {
        return `${constness}${typeName} ${name};`;
      }

      return `${constness}${typeName} ${name} = ${lowerExpression(d.initializer, context)};`;
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
  const typeName = getTypeName(node.app, node.getType());
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
  const { pathToId } = context;

  if (node instanceof NodeBooleanLiteral) {
    return node.value.toString();
  }

  if (node instanceof NodeNullLiteral) {
    return 'ssc__core__var__null';
  }

  if (node instanceof NodeParenthesizedExpression) {
    return lowerExpression(node.expression, context);
  }

  if (node instanceof NodeNumericLiteral) {
    const type = node.getContextualType() || node.getType();

    if (!type.isUnionType()) {
      return getNumericLiteral(node.value, getTypeName(node.app, type));
    }

    const memberTypeNames = type.getTypes().map((t) => getTypeName(node.app, t));
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

    const declaration = node.getValueDeclaration();

    assert(
      ast.isParameterDeclaration(declaration) || ast.isVariableDeclaration(declaration),
      `${node.location()}: not implemented identifier: ${node.text}`,
    );

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

    if (kind === ast.SyntaxKind.PlusToken) {
      return `(${lowerExpression(node.left, context)} + ${lowerExpression(node.right, context)})`;
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
      const namespaceName = getNamespaceName(pathToId(realPath));
      const functionName = getFunctionName(functionDeclaration);
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

function addImportedForward(
  context: LowerContext,
  realPath: RealPath,
  name: string,
  forward: string,
) {
  const forwards = context.importedForwardMap.get(realPath) || new Map<string, string>();

  forwards.set(name, forward);
  context.importedForwardMap.set(realPath, forwards);
}

// TODO: review
function lowerVariableReference(node: NodeIdentifier, context: LowerContext) {
  const topLevelVariable = context.topLevelVariableMap.get(node.getSymbol().id);

  if (topLevelVariable) {
    return topLevelVariable;
  }

  const declaration = node.getValueDeclaration();

  if (declaration.getSourceFile().fileName === node.getSourceFile().fileName) {
    return getVariableName(node.text);
  }

  return declareImportedVariable(node, context);
}

// TODO: review
function declareImportedVariable(node: NodeIdentifier, context: LowerContext) {
  const declaration = node.getValueDeclaration();

  assert(ast.isVariableDeclaration(declaration), `not in scope: ${node.text}`);
  assert(
    !declaration.getSourceFile().isDeclarationFile,
    `${node.location()}: not implemented ambient variable: ${node.text}`,
  );

  const { identifier } = new NodeVariableDeclaration(node.app, declaration).bindingName;
  const realPath = node.app.parser.tsPathToRealPath(declaration.getSourceFile().fileName);
  const name = getVariableName(identifier.text);
  const topLevelVariable = `${getNamespaceName(context.pathToId(realPath))}::${name}`;

  addImportedForward(
    context,
    realPath,
    name,
    `extern ${getTypeName(node.app, identifier.getType())} ${name};`,
  );
  context.topLevelVariableMap.set(node.getSymbol().id, topLevelVariable);

  return topLevelVariable;
}

function narrowUnion(node: AbstractNode<ast.Expression>, text: string) {
  const declaredType = node.app.checker.getTypeOfSymbol(node.getSymbol());

  if (getTypeName(node.app, declaredType) !== 'ssc__core__type__union') {
    return text;
  }

  const typeName = getTypeName(node.app, node.getType());

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

function lowerParameter(node: NodeParameterDeclaration) {
  const { identifier } = node.bindingName;

  return `${getTypeName(node.app, identifier.getType())} ${getVariableName(identifier.text)}`;
}

function getTypeName(app: AppSourceFile['app'], type: ts.Type): string {
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
