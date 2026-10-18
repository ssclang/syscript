import { assert, assertNever } from '@syscript/share/util';
import * as ast from 'typescript7/ast';
import * as ts from 'typescript7/sync';
import { CppWriter } from '~/cpp/writer.js';
import {
  AbstractNode,
  AbstractStatement,
  AppSourceFile,
  isTypeFlagMatch,
  NodeBinaryExpression,
  NodeCallExpression,
  NodeExpressionStatement,
  NodeFunctionDeclaration,
  NodeIdentifier,
  NodeImportDeclaration,
  NodeNumericLiteral,
  NodeParameterDeclaration,
  NodeReturnStatement,
} from '~/ts/node.js';
import { RealPath } from '~/util/path.js';

type LowerContext = {
  pathToId: (path: RealPath) => string;
  importedFunctionMap: Map<RealPath, Map<string, NodeFunctionDeclaration>>;
};

export function lower(sourceFile: AppSourceFile, pathToId: (path: RealPath) => string) {
  assert(
    !sourceFile.isDeclarationFile,
    `declaration file can not be lowered: ${sourceFile.realPath}`,
  );

  const context: LowerContext = { pathToId, importedFunctionMap: new Map() };
  const pathId = pathToId(sourceFile.realPath);
  const namespaceName = getNamespaceName(pathId);

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

  for (const entry of context.importedFunctionMap) {
    const [realPath, importedFunctions] = entry;

    w.block(`namespace ${getNamespaceName(pathToId(realPath))}`, () => {
      return importedFunctions
        .values()
        .map((f) => {
          assert(f.isExported, `${f.location()}: not exported function can not be imported`);
          return `${getFunctionSignature(f)};`;
        })
        .toArray();
    });

    w.newline();
    w.newline();
  }

  w.block(`namespace ${namespaceName}`, () => [
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
      .flatMap((s) => lowerStatement(s, context))
      .toArray();
  });

  return w.lines();
}

function lowerStatement(node: AbstractStatement, context: LowerContext) {
  if (node instanceof NodeExpressionStatement) {
    return [`${lowerExpression(node.expression, context)};`];
  }

  if (node instanceof NodeReturnStatement) {
    const line =
      node.expression ? `return ${lowerExpression(node.expression, context)};` : 'return;';
    return [line];
  }

  throw new Error(`not implemented statement: ${node.getText()}`);
}

function lowerExpression(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  const { pathToId, importedFunctionMap } = context;

  if (node instanceof NodeNumericLiteral) {
    const type = node.getContextualType() || node.getType();
    const typeName = getTypeName(node.app, type);

    return getNumericLiteral(node.value, typeName);
  }

  if (node instanceof NodeIdentifier) {
    const declaration = node.getValueDeclaration();

    assert(
      ast.isParameterDeclaration(declaration),
      `${node.location()}: not implemented identifier: ${node.text}`,
    );

    return getVariableName(node.text);
  }

  if (node instanceof NodeBinaryExpression) {
    const { kind } = node.binaryOperatorToken;

    assert(kind === ast.SyntaxKind.PlusToken, `not implemented operator: ${ast.SyntaxKind[kind]}`);

    return `(${lowerExpression(node.left, context)} + ${lowerExpression(node.right, context)})`;
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

        const functions =
          importedFunctionMap.get(realPath) || new Map<string, NodeFunctionDeclaration>();

        functions.set(functionName, functionDeclaration);
        importedFunctionMap.set(realPath, functions);
      }

      return `${namespaceName}::${functionName}(${args})`;
    }

    throw new Error(`${callee.location()}: not implemented callee: ${callee.text}`);
  }

  throw new Error(`not implemented expression: ${node.getText()}`);
}

function lowerParameter(node: NodeParameterDeclaration) {
  const { identifier } = node.bindingName;

  return `${getTypeName(node.app, identifier.getType())} ${getVariableName(identifier.text)}`;
}

function getTypeName(app: AppSourceFile['app'], type: ts.Type): string {
  if (isTypeFlagMatch(type, ts.TypeFlags.Void)) {
    return 'void';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return 'ssc__core__type__f64';
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
