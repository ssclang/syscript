import { assert, assertNever } from '@syscript/share/util';
import BigNumber from 'bignumber.js';
import * as ast from 'typescript7/ast';
import * as ts from 'typescript7/sync';
import { Capture } from '~/cpp/closure.js';
import { CppCoreFunctionName } from '~/cpp/core.js';
import {
  CppBlock,
  CppBooleanLiteral,
  CppBreakStatement,
  CppContinueStatement,
  CppCoreFunctionCall,
  CppCStringLiteral,
  CppDeclarationStatement,
  CppNode,
  CppNullLiteral,
  CppExpression,
  CppExpressionStatement,
  CppForStatement,
  CppFunctionCall,
  CppFunctionDeclaration,
  CppFunctionStorage,
  CppIfStatement,
  CppNumericLiteral,
  CppReturnStatement,
  CppStatement,
  CppUnknownExpression,
  CppStringLiteral,
  CppUndefinedLiteral,
  CppUnknownDeclaration,
  CppVariableDeclaration,
  CppVariableStorage,
  CppWhileStatement,
} from '~/cpp/node.js';
import { CppWriter } from '~/cpp/writer.js';
import { includes, sscFloatTypes, SscNumberType, sscNumberTypes } from '~/ssc/type.js';
import { commonType, CommonTypeOperand, isLiteralInRange, isLossless } from '~/ts/common-type.js';
import {
  AbstractNode,
  AbstractStatement,
  AppSourceFile,
  isTypeFlagMatch,
  NodeArrayLiteralExpression,
  NodeAsExpression,
  NodeBinaryExpression,
  NodeBlock,
  NodeBooleanLiteral,
  NodeBreakStatement,
  NodeCallExpression,
  NodeConditionalExpression,
  NodeContinueStatement,
  NodeElementAccessExpression,
  NodeExpressionStatement,
  NodeForStatement,
  NodeFunctionDeclaration,
  NodeFunctionExpression,
  NodeIdentifier,
  NodeIfStatement,
  NodeImportDeclaration,
  NodeNullLiteral,
  NodeNumericLiteral,
  NodeObjectLiteralExpression,
  NodeParenthesizedExpression,
  NodePostfixUnaryExpression,
  NodePrefixUnaryExpression,
  NodePropertyAccessExpression,
  NodeReturnStatement,
  NodeStringLiteral,
  NodeTemplateExpression,
  NodeTypeDeclaration,
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
  boxedVariableSymbolIdSet: Set<number>;
  closureCaptureMap: Map<ast.Node, Capture[]>;
};

type LowerContext = TopLevelContext | FunctionContext | ClosureContext;

type GlobalContext = {
  kind: 'global';
  programContext: ProgramContext;
  importedForwardMap: Map<RealPath, Map<string, string>>;
  functionValueDefinitionMap: Map<string, string>;
  shapeDefinitionMap: Map<string, string>;
  variableDeclarationMap: Map<number, CppVariableDeclaration>;
  functionDeclarationMap: Map<number, CppFunctionDeclaration>;
};

type TopLevelContext = {
  kind: 'topLevel';
  globalContext: GlobalContext;
};

type FunctionContext = {
  kind: 'function';
  globalContext: GlobalContext;
};

type ClosureContext = {
  kind: 'closure';
  globalContext: GlobalContext;
  captures: Capture[];
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
    functionValueDefinitionMap: new Map<string, string>(),
    shapeDefinitionMap: new Map<string, string>(),
    variableDeclarationMap: new Map<number, CppVariableDeclaration>(),
    functionDeclarationMap: new Map<number, CppFunctionDeclaration>(),
  } as const satisfies GlobalContext;
  const topLevelContext = { kind: 'topLevel', globalContext } as const satisfies TopLevelContext;
  const pathId = pathToId(sourceFile.realPath);
  const namespaceName = CppNode.toCppNamespaceName(pathId);
  const topLevelVariableDefinitions = sourceFile.statements
    .values()
    .filter((s) => s instanceof NodeVariableStatement)
    .flatMap((s) => s.declarations)
    .flatMap((d) => {
      const { identifier } = d.bindingName;
      const symbolId = identifier.getSymbol().id;
      const storage = d.isExported ? 'exportedTopLevel' : 'topLevel';
      const declaration = declareVariable(identifier, topLevelContext, storage, false);
      const definitions = [new CppDeclarationStatement(declaration).code()];

      if (tdzVariableSymbolIdSet.has(symbolId)) {
        definitions.push(`${declaration.tdzTagCode()};`);
      }

      return definitions;
    })
    .toArray();
  const functions = sourceFile.statements.filter((n) => n instanceof NodeFunctionDeclaration);
  const functionForwards = functions.map((f) =>
    new CppDeclarationStatement(
      declareFunction(f, topLevelContext, getTopLevelFunctionStorage(f)),
    ).code(),
  );
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

    w.block(`namespace ${CppNode.toCppNamespaceName(pathToId(realPath))}`, () =>
      forwards.values().toArray(),
    );
    w.newline();
    w.newline();
  }

  w.block(`namespace ${namespaceName}`, () => [
    ...topLevelVariableDefinitions,
    ...functionForwards,
    ...globalContext.shapeDefinitionMap.values(),
    ...globalContext.functionValueDefinitionMap.values(),
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
    w.block(`export namespace ${CppNode.toCppNamespaceName(pathId)}`, () => [
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
        (id) =>
          `${CppNode.toCppNamespaceName(id)}::${getSscTopLevelStatementsInitFunctionName(id)}();`,
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

function getSscTopLevelStatementsInitFunctionName(pathId: string) {
  return `ssc__core__fn__${pathId}`;
}

function getSscBoxName(name: string) {
  return `ssc__ts__box__${name}`;
}

function getPathId(identifier: NodeIdentifier, context: LowerContext) {
  const { pathToId } = context.globalContext.programContext;

  return pathToId(identifier.app.parser.tsPathToRealPath(identifier.getSourceFile().fileName));
}

function declareVariable(
  identifier: NodeIdentifier,
  context: LowerContext,
  storage: CppVariableStorage,
  isConst: boolean,
  initializer?: CppExpression,
) {
  const { variableDeclarationMap } = context.globalContext;
  const symbol = identifier.getSymbol();
  const declaration = variableDeclarationMap.get(symbol.id);

  if (declaration) {
    return declaration;
  }

  const type = identifier.app.checker.getTypeOfSymbol(symbol);
  const pathId = storage === 'local' ? undefined : getPathId(identifier, context);
  const newDeclaration = new CppVariableDeclaration(
    pathId,
    storage,
    isConst,
    getSscTypeName(identifier.app, type),
    identifier.text,
    initializer,
  );

  variableDeclarationMap.set(symbol.id, newDeclaration);

  return newDeclaration;
}

function getVariableReference(identifier: NodeIdentifier, context: LowerContext) {
  const declaration = context.globalContext.variableDeclarationMap.get(identifier.getSymbol().id);

  assert(
    declaration,
    `${identifier.location()}: variable declaration not found: ${identifier.text}`,
  );

  return declaration.reference;
}

function getTopLevelFunctionStorage(node: NodeFunctionDeclaration) {
  return node.isExported ? 'exportedTopLevel' : 'topLevel';
}

function declareFunction(
  node: NodeFunctionDeclaration,
  context: LowerContext,
  storage: CppFunctionStorage,
) {
  const { functionDeclarationMap } = context.globalContext;
  const { identifier } = node;
  const symbolId = identifier.getSymbol().id;
  const declaration = functionDeclarationMap.get(symbolId);

  if (declaration) {
    return declaration;
  }

  assert(
    !node.isDeclared || !identifier.text.startsWith('ssc__'),
    `${node.location()}: '${identifier.text}' is reserved`,
  );

  const returnTypeName = getSscTypeName(node.app, node.getReturnType());
  const parameters = node.parameters.map((p) =>
    declareVariable(p.bindingName.identifier, context, 'local', false),
  );
  const newDeclaration = new CppFunctionDeclaration(
    getPathId(identifier, context),
    storage,
    node.isDeclared,
    returnTypeName,
    identifier.text,
    parameters,
  );

  functionDeclarationMap.set(symbolId, newDeclaration);

  return newDeclaration;
}

function lowerFunction(node: NodeFunctionDeclaration, topLevelContext: TopLevelContext) {
  assert(!node.isDeclared, `${node.location()}: declared function can not be lowered`);

  const context = {
    kind: 'function',
    globalContext: topLevelContext.globalContext,
  } as const satisfies FunctionContext;
  const w = new CppWriter();

  w.block(declareFunction(node, context, getTopLevelFunctionStorage(node)).code(), () => {
    assert(node.block); // TODO: remove
    const boxes = node.parameters
      .map((p) => p.bindingName.identifier)
      .filter((i) => isBoxedVariable(i, context))
      .map(
        (i) =>
          `ssc__core__type__ref ${getSscBoxName(i.text)} = ssc__core__fn__box(${getVariableReference(i, context).code()});`,
      );

    return [
      ...boxes,
      ...node.block.statements
        .values()
        .flatMap((s) =>
          lowerStatement(s, context).flatMap((statement) => statement.code().split('\n')),
        )
        .toArray(),
    ];
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

        return lowerStatement(s, context).flatMap((statement) => statement.code().split('\n'));
      })
      .toArray();
  });

  return w.lines();
}

function lowerTopLevelVariableStatement(node: NodeVariableStatement, context: TopLevelContext) {
  return node.declarations.flatMap((d) => {
    const { identifier } = d.bindingName;
    const { tdzVariableSymbolIdSet } = context.globalContext.programContext;
    const lines: string[] = [];

    const addAssignment = (left: string, right: string) => {
      lines.push(`${left} = ${right};`);
    };

    if (d.initializer) {
      addAssignment(
        getVariableReference(identifier, context).code(),
        lowerValue(d.initializer, context),
      );
    }

    if (tdzVariableSymbolIdSet.has(identifier.getSymbol().id)) {
      addAssignment(getVariableReference(identifier, context).tdzTagCode(), 'true');
    }

    return lines;
  });
}

function lowerStatement(node: AbstractStatement, context: LowerContext): CppStatement[] {
  if (node instanceof NodeExpressionStatement) {
    const expression = new CppUnknownExpression(lowerExpression(node.expression, context));

    return [new CppExpressionStatement(expression)];
  }

  if (node instanceof NodeIfStatement) {
    return [lowerIfStatement(node, context)];
  }

  if (node instanceof NodeVariableStatement) {
    return node.declarations.map(
      (d) => new CppDeclarationStatement(lowerVariableDeclaration(d, context)),
    );
  }

  if (node instanceof NodeReturnStatement) {
    if (context.kind === 'closure') {
      const value =
        node.expression ? lowerValue(node.expression, context) : new CppUndefinedLiteral().code();

      return [new CppReturnStatement(new CppUnknownExpression(`ssc__core__type__union(${value})`))];
    }

    if (!node.expression) {
      return [new CppReturnStatement()];
    }

    return [new CppReturnStatement(new CppUnknownExpression(lowerValue(node.expression, context)))];
  }

  if (node instanceof NodeBlock) {
    return [new CppBlock(node.statements.flatMap((s) => lowerStatement(s, context)))];
  }

  if (node instanceof NodeForStatement) {
    return [lowerForStatement(node, context)];
  }

  if (node instanceof NodeWhileStatement) {
    return [lowerWhileStatement(node, context)];
  }

  if (node instanceof NodeTypeDeclaration) {
    return [];
  }

  if (node instanceof NodeBreakStatement) {
    return [new CppBreakStatement()];
  }

  if (node instanceof NodeContinueStatement) {
    return [new CppContinueStatement()];
  }

  throw new Error(`not implemented statement: ${node.getText()}`);
}

function lowerVariableDeclaration(node: NodeVariableDeclaration, context: LowerContext) {
  const { identifier } = node.bindingName;

  if (isBoxedVariable(identifier, context)) {
    const value = node.initializer ? lowerValue(node.initializer, context) : '';

    return new CppUnknownDeclaration(
      `ssc__core__type__ref ${getSscBoxName(identifier.text)} = ssc__core__fn__box(ssc__core__type__union(${value}))`,
    );
  }

  const isConst = node.keyword === 'const';
  const initializer =
    node.initializer ? new CppUnknownExpression(lowerValue(node.initializer, context)) : undefined;

  return declareVariable(identifier, context, 'local', isConst, initializer);
}

function lowerIfStatement(node: NodeIfStatement, context: LowerContext): CppIfStatement {
  const condition = new CppUnknownExpression(lowerCondition(node.expression, context));
  const statements = node.block.statements.flatMap((s) => lowerStatement(s, context));
  const { elseStatement } = node;

  if (elseStatement instanceof NodeIfStatement) {
    return new CppIfStatement(condition, statements, lowerIfStatement(elseStatement, context));
  }

  if (elseStatement instanceof NodeBlock) {
    const elseStatements = elseStatement.statements.flatMap((s) => lowerStatement(s, context));

    return new CppIfStatement(condition, statements, new CppBlock(elseStatements));
  }

  return new CppIfStatement(condition, statements);
}

function lowerForStatement(node: NodeForStatement, context: LowerContext) {
  const declarations = node.declarations.map((d) => lowerVariableDeclaration(d, context));
  const condition = new CppUnknownExpression(lowerCondition(node.condition, context));
  const renewals = node.declarations
    .map((d) => d.bindingName.identifier)
    .filter((i) => isBoxedVariable(i, context))
    .map((i) => {
      const name = getSscBoxName(i.text);

      return `${name} = ssc__core__fn__box(ssc__core__fn__box_value(${name}.ssc__core__member__get_object_header_pointer())), `;
    });
  const incrementor = new CppUnknownExpression(
    `${renewals.join('')}${lowerExpression(node.incrementor, context)}`,
  );
  const statements = node.block.statements.flatMap((s) => lowerStatement(s, context));
  const [declaration] = declarations;

  if (declarations.length === 1 && declaration) {
    return new CppForStatement(declaration, condition, incrementor, statements);
  }

  return new CppBlock([
    ...declarations.map((d) => new CppDeclarationStatement(d)),
    new CppForStatement(undefined, condition, incrementor, statements),
  ]);
}

function lowerWhileStatement(node: NodeWhileStatement, context: LowerContext) {
  const condition = new CppUnknownExpression(lowerCondition(node.expression, context));
  const statements = node.block.statements.flatMap((s) => lowerStatement(s, context));

  return new CppWhileStatement(condition, statements);
}

function lowerCondition(node: AbstractNode<ast.Expression>, context: LowerContext) {
  const typeName = getSscTypeName(node.app, node.getType());
  const text = lowerExpression(node, context);

  return getTruthyCondition(typeName, text);
}

function getTruthyCondition(typeName: string, text: string) {
  if (typeName === 'union') {
    return new CppCoreFunctionCall(
      'ssc__core__fn__truthy_union',
      [],
      [new CppUnknownExpression(text)],
    ).code();
  }

  if (typeName === 'ref') {
    return new CppCoreFunctionCall(
      'ssc__core__fn__truthy_ref',
      [],
      [new CppUnknownExpression(text)],
    ).code();
  }

  if (typeName === 'boolean') {
    return text;
  }

  if (typeName === 'f32') {
    return new CppCoreFunctionCall(
      'ssc__core__fn__truthy_f32',
      [],
      [new CppUnknownExpression(text)],
    ).code();
  }

  if (typeName === 'f64') {
    return new CppCoreFunctionCall(
      'ssc__core__fn__truthy_f64',
      [],
      [new CppUnknownExpression(text)],
    ).code();
  }

  if (
    typeName === 'i8'
    || typeName === 'i16'
    || typeName === 'i32'
    || typeName === 'i64'
    || typeName === 'u8'
    || typeName === 'u16'
    || typeName === 'u32'
    || typeName === 'u64'
    || typeName === 'char'
  ) {
    return `${text} != 0`;
  }

  assertNever(typeName as never);
}

function lowerExpression(node: AbstractNode<ast.Expression>, context: LowerContext): string {
  if (node instanceof NodeBooleanLiteral) {
    return new CppBooleanLiteral(node.value).code();
  }

  if (node instanceof NodeNullLiteral) {
    return new CppNullLiteral().code();
  }

  if (node instanceof NodeParenthesizedExpression) {
    return `(${lowerExpression(node.expression, context)})`;
  }

  if (isEffectiveNumericLiteral(node)) {
    const bigNumber = getNumberLiteralValue(node.app, node.getType());
    const value = bigNumber.toFixed();
    const contextualType = node.app.checker.getContextualType(node.tsNode);
    const type =
      contextualType && !isTypeFlagMatch(contextualType, ts.TypeFlags.AnyOrUnknown) ?
        contextualType
      : node.getType();

    if (!type.isUnionType()) {
      return new CppNumericLiteral(getSscNumberType(node, type), value).code();
    }

    const numberTypes = type
      .getTypes()
      .filter((t) => !isTypeFlagMatch(t, ts.TypeFlags.Literal))
      .map((t) => getSscTypeName(node.app, t))
      .filter<SscNumberType>((t) => includes(sscNumberTypes, t));
    const [numberType] = numberTypes;

    if (numberTypes.length === 1 && numberType) {
      assert(
        isLiteralInRange(bigNumber, numberType),
        `${node.location()}: '${node.getText()}' can not be converted to ${numberType}`,
      );

      return new CppNumericLiteral(numberType, value).code();
    }

    return new CppNumericLiteral(getUnionNumberLiteralStorageType(bigNumber), value).code();
  }

  if (node instanceof NodeStringLiteral) {
    return new CppStringLiteral(node.value).code();
  }

  if (node instanceof NodeTemplateExpression) {
    return lowerTemplateExpression(node, context);
  }

  if (node instanceof NodePropertyAccessExpression) {
    return lowerPropertyAccessExpression(node, context);
  }

  if (node instanceof NodeTypeOfExpression) {
    return lowerTypeOfExpression(node, context);
  }

  if (node instanceof NodeAsExpression) {
    return lowerAsExpression(node, context);
  }

  if (node instanceof NodeConditionalExpression) {
    return lowerConditionalExpression(node, context);
  }

  if (node instanceof NodeFunctionExpression) {
    return lowerFunctionExpression(node, context);
  }

  if (node instanceof NodeArrayLiteralExpression) {
    return lowerArrayLiteralExpression(node, context);
  }

  if (node instanceof NodeElementAccessExpression) {
    return lowerElementAccessExpression(node, context);
  }

  if (node instanceof NodeObjectLiteralExpression) {
    return lowerObjectLiteralExpression(node, context);
  }

  if (node instanceof NodePrefixUnaryExpression) {
    return lowerPrefixUnaryExpression(node, context);
  }

  if (node instanceof NodePostfixUnaryExpression) {
    return lowerPostfixUnaryExpression(node, context);
  }

  if (node instanceof NodeIdentifier) {
    if (node.app.checker.isUndefinedSymbol(node.getSymbol())) {
      return new CppUndefinedLiteral().code();
    }

    if (ast.isFunctionDeclaration(node.getValueDeclaration())) {
      return lowerFunctionValue(node, context);
    }

    return narrowUnion(node, lowerVariableReference(node, context), context);
  }

  if (node instanceof NodeBinaryExpression) {
    const { kind } = node.binaryOperatorToken;

    // =
    if (kind === ast.SyntaxKind.EqualsToken && node.left instanceof NodeElementAccessExpression) {
      return lowerElementAssignmentExpression(node.left, node.right, context);
    }

    // =
    if (kind === ast.SyntaxKind.EqualsToken && node.left instanceof NodePropertyAccessExpression) {
      return `(${lowerFieldReference(node.left, context)} = ${lowerValue(node.right, context)})`;
    }

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

    // ??
    if (kind === ast.SyntaxKind.QuestionQuestionToken) {
      return lowerNullishExpression(node, context);
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

    if (callee instanceof NodePropertyAccessExpression) {
      return lowerMethodCallExpression(node, callee, context);
    }

    if (
      !(callee instanceof NodeIdentifier)
      || !ast.isFunctionDeclaration(callee.getValueDeclaration())
    ) {
      return lowerFunctionValueCallExpression(node, context);
    }

    const declaration = callee.getValueDeclaration();
    const realPath = node.app.parser.tsPathToRealPath(declaration.getSourceFile().fileName);
    const isSameFile = declaration.getSourceFile().fileName === node.getSourceFile().fileName;

    if (realPath === node.app.preludeSourceFile.realPath) {
      return lowerPreludeCallExpression(node, callee.text, context);
    }

    if (ast.isFunctionDeclaration(declaration)) {
      const functionDeclaration = new NodeFunctionDeclaration(node.app, declaration);
      const storage = isSameFile ? getTopLevelFunctionStorage(functionDeclaration) : 'imported';
      const cppDeclaration = declareFunction(functionDeclaration, context, storage);
      const args = node.arguments.map((a) => new CppUnknownExpression(lowerValue(a, context)));

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
          cppDeclaration.reference.code(),
          new CppDeclarationStatement(cppDeclaration).code(),
        );
      }

      return new CppFunctionCall(cppDeclaration.reference, args).code();
    }

    throw new Error(`${callee.location()}: not implemented callee: ${callee.text}`);
  }

  throw new Error(`not implemented expression: ${node.getText()}`);
}

function lowerFunctionValueCallExpression(node: NodeCallExpression, context: LowerContext) {
  const args = node.arguments.map((a) => `ssc__core__type__union(${lowerValue(a, context)})`);
  const text = `ssc__core__fn__call(${lowerExpression(node.expression, context)}, {${args.join(', ')}})`;
  const typeName = getSscTypeName(node.app, node.getType());

  if (typeName === 'void' || typeName === 'union') {
    return text;
  }

  return getUnionReadText(typeName, text);
}

function lowerFunctionExpression(node: NodeFunctionExpression, context: LowerContext) {
  const captures = context.globalContext.programContext.closureCaptureMap.get(node.tsNode) || [];
  const closureContext = {
    kind: 'closure',
    globalContext: context.globalContext,
    captures,
  } as const satisfies ClosureContext;
  const parameters = node.parameters.map((p, index) => {
    const { identifier } = p.bindingName;
    const argument = `ssc__core__var__arguments[${index}]`;

    if (isBoxedVariable(identifier, closureContext)) {
      return `ssc__core__type__ref ${getSscBoxName(identifier.text)} = ssc__core__fn__box(${argument});`;
    }

    const typeName = getSscTypeName(node.app, identifier.getType());
    const value = typeName === 'union' ? argument : getUnionReadText(typeName, argument);

    const declaration = declareVariable(
      identifier,
      closureContext,
      'local',
      true,
      new CppUnknownExpression(value),
    );

    return new CppDeclarationStatement(declaration).code();
  });
  const body =
    node.body instanceof NodeBlock ?
      node.body.statements
        .flatMap((s) => lowerStatement(s, closureContext))
        .flatMap((statement) => statement.code().split('\n'))
    : [`return ssc__core__type__union(${lowerValue(node.body, closureContext)});`];
  const lines = [
    ...parameters,
    ...body,
    `return ssc__core__type__union(${new CppUndefinedLiteral().code()});`,
  ];
  const lambda = `+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { ${lines.join(' ')} }`;
  const boxes = captures.map((c) => getBoxPointerText(c, context));

  return `ssc__core__fn__closure(${lambda}, {${boxes.join(', ')}})`;
}

function lowerFunctionValue(node: NodeIdentifier, context: LowerContext) {
  const declaration = new NodeFunctionDeclaration(
    node.app,
    node.getValueDeclaration() as ast.FunctionDeclaration,
  );

  assert(
    !declaration.isDeclared && declaration.getSourceFile() === node.getSourceFile(),
    `${node.location()}: not implemented function value: ${node.text}`,
  );

  const name = `ssc__ts__closure__${declaration.identifier.text}`;
  const parameters = declaration.parameters.map((p, index) => {
    const typeName = getSscTypeName(node.app, p.bindingName.identifier.getType());
    const argument = `ssc__core__var__arguments[${index}]`;

    return new CppUnknownExpression(
      typeName === 'union' ? argument : getUnionReadText(typeName, argument),
    );
  });
  const storage = getTopLevelFunctionStorage(declaration);
  const { reference } = declareFunction(declaration, context, storage);
  const call = new CppFunctionCall(reference, parameters).code();
  const isVoid = getSscTypeName(node.app, declaration.getReturnType()) === 'void';
  const body =
    isVoid ?
      `${call}; return ssc__core__type__union(${new CppUndefinedLiteral().code()});`
    : `return ssc__core__type__union(${call});`;

  context.globalContext.functionValueDefinitionMap.set(
    name,
    `const ssc__core__struct__closure ${name}{{0, __builtin_addressof(ssc__core__var__closure_descriptor)}, +[](const ssc__core__struct__closure*, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { ${body} }, {0, nullptr}};`,
  );

  return `ssc__core__fn__function_value(${name})`;
}

function isBoxedVariable(node: NodeIdentifier, context: LowerContext) {
  return context.globalContext.programContext.boxedVariableSymbolIdSet.has(node.getSymbol().id);
}

function getBoxPointerText(capture: Capture, context: LowerContext) {
  const index =
    context.kind === 'closure' ?
      context.captures.findIndex((c) => c.symbolId === capture.symbolId)
    : -1;

  if (index !== -1) {
    return `ssc__core__var__closure->ssc__core__member__captures[${index}]`;
  }

  return `${getSscBoxName(capture.name)}.ssc__core__member__get_object_header_pointer()`;
}

function lowerMethodCallExpression(
  node: NodeCallExpression,
  callee: NodePropertyAccessExpression,
  context: LowerContext,
) {
  const { expression } = callee;

  if (
    callee.name === 'write'
    && expression instanceof NodePropertyAccessExpression
    && (expression.name === 'stdout' || expression.name === 'stderr')
    && expression.expression instanceof NodeIdentifier
    && expression.expression.text === 'process'
    && isPreludeDeclaration(expression.expression)
  ) {
    const [text] = node.arguments;

    assert(text, `${node.location()}: '${callee.getText()}' takes an argument`);

    return `ssc__core__fn__write_${expression.name}(${lowerString(text, context)})`;
  }

  if (
    (callee.name === 'log' || callee.name === 'error')
    && expression instanceof NodeIdentifier
    && expression.text === 'console'
    && isPreludeDeclaration(expression)
  ) {
    const args = node.arguments.map((a) => lowerExpression(a, context)).join(', ');

    return `ssc__core__fn__console_${callee.name}(${args})`;
  }

  if (expression.app.checker.isArrayType(expression.getType())) {
    const elementType = getArrayElementSscTypeName(expression);
    const array = lowerExpression(expression, context);

    if (callee.name === 'push') {
      const values = node.arguments.map((a) => `, ${lowerValue(a, context)}`).join('');

      return `ssc__core__fn__array_push<${elementType}>(${array}${values})`;
    }

    if (callee.name === 'pop') {
      return `ssc__core__fn__array_pop<${elementType}>(${array})`;
    }

    const [first, second] = node.arguments;

    assert(first, `${node.location()}: '${callee.getText()}' takes an argument`);

    const argument = lowerValue(first, context);

    if (callee.name === 'map') {
      return `ssc__core__fn__array_map<${elementType}, ${getArrayElementSscTypeName(node)}>(${array}, ${argument})`;
    }

    if (callee.name === 'reduce') {
      assert(second, `${node.location()}: 'reduce' takes an initial value`);

      const text = `ssc__core__fn__array_reduce<${elementType}>(${array}, ${argument}, ssc__core__type__union(${lowerValue(second, context)}))`;
      const typeName = getSscTypeName(node.app, node.getType());

      return typeName === 'union' ? text : getUnionReadText(typeName, text);
    }

    if (callee.name === 'forEach') {
      return `ssc__core__fn__array_for_each<${elementType}>(${array}, ${argument})`;
    }

    if (callee.name === 'filter') {
      return `ssc__core__fn__array_filter<${elementType}>(${array}, ${argument})`;
    }

    if (callee.name === 'find') {
      return `ssc__core__fn__array_find<${elementType}>(${array}, ${argument})`;
    }

    if (callee.name === 'some') {
      return `ssc__core__fn__array_some<${elementType}>(${array}, ${argument})`;
    }

    if (callee.name === 'every') {
      return `ssc__core__fn__array_every<${elementType}>(${array}, ${argument})`;
    }

    if (callee.name === 'indexOf') {
      return `ssc__core__fn__array_index_of<${elementType}>(${array}, ${argument})`;
    }
  }

  throw new Error(`${callee.location()}: not implemented callee: ${callee.getText()}`);
}

function lowerArrayLiteralExpression(node: NodeArrayLiteralExpression, context: LowerContext) {
  const elementType = getArrayElementSscTypeName(node);
  const values = node.elements.map((e) => lowerValue(e, context)).join(', ');

  return `ssc__core__fn__array_of<${elementType}>(${values})`;
}

function lowerElementAccessExpression(node: NodeElementAccessExpression, context: LowerContext) {
  const { expression, argumentExpression } = node;
  const elementType = getArrayElementSscTypeName(expression);

  return `ssc__core__fn__array_get<${elementType}>(${lowerExpression(expression, context)}, ${lowerArrayIndex(argumentExpression, context)})`;
}

function lowerElementAssignmentExpression(
  node: NodeElementAccessExpression,
  value: AbstractNode<ast.Expression>,
  context: LowerContext,
) {
  const { expression, argumentExpression } = node;
  const elementType = getArrayElementSscTypeName(expression);
  const array = lowerExpression(expression, context);
  const index = lowerArrayIndex(argumentExpression, context);

  return `ssc__core__fn__array_set<${elementType}>(${array}, ${index}, ${lowerValue(value, context)})`;
}

function lowerArrayIndex(node: AbstractNode<ast.Expression>, context: LowerContext) {
  return lowerNumber(node, 'u64', context);
}

function getArrayElementSscTypeName(node: AbstractNode<ast.Expression>) {
  const { checker } = node.app;
  const type = checker.getContextualType(node.tsNode) || node.getType();
  const arrayType = checker.isArrayType(type) ? type : node.getType();

  assert(checker.isArrayType(arrayType), `${node.location()}: not an array: ${node.getText()}`);

  const [elementType] = checker.getTypeArguments(arrayType as ts.TypeReference);

  assert(elementType, `${node.location()}: array element type not found: ${node.getText()}`);

  return CppNode.toCppTypeName(getSscTypeName(node.app, elementType));
}

function isPreludeDeclaration(node: NodeIdentifier) {
  const declarationFile = node.getValueDeclaration().getSourceFile();

  return (
    node.app.parser.tsPathToRealPath(declarationFile.fileName)
    === node.app.preludeSourceFile.realPath
  );
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
    const args = [new CppUnknownExpression(lowerNumber(argument, 'u32', context))];

    return new CppCoreFunctionCall('ssc__core__fn__char', [], args).code();
  }

  if (name === 'addWrap' || name === 'subWrap' || name === 'mulWrap') {
    const [, right] = node.arguments;

    assert(right, `${node.location()}: '${name}' takes two arguments`);

    const type = getSscNumberType(node);
    const functionName = getSscWrappingArithmeticFunctionName(name);

    const args = [
      new CppUnknownExpression(lowerNumber(argument, type, context)),
      new CppUnknownExpression(lowerNumber(right, type, context)),
    ];

    return new CppCoreFunctionCall(functionName, [], args).code();
  }

  throw new Error(`${node.location()}: not implemented prelude function: ${name}`);
}

function getSscWrappingArithmeticFunctionName(
  name: 'addWrap' | 'subWrap' | 'mulWrap',
): CppCoreFunctionName {
  if (name === 'addWrap') {
    return 'ssc__core__fn__add_wrap';
  }

  if (name === 'subWrap') {
    return 'ssc__core__fn__sub_wrap';
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (name === 'mulWrap') {
    return 'ssc__core__fn__mul_wrap';
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

    const args = [
      new CppNumericLiteral(type, '0'),
      new CppUnknownExpression(text),
      new CppCStringLiteral(type),
    ];

    return new CppCoreFunctionCall('ssc__core__fn__sub', [], args).code();
  }

  // +
  if (operator === ast.SyntaxKind.PlusToken) {
    return lowerNumber(operand, getSscNumberType(node), context);
  }

  // ~
  if (operator === ast.SyntaxKind.TildeToken) {
    const text = lowerNumber(operand, getSscNumberType(node), context);

    return new CppCoreFunctionCall(
      'ssc__core__fn__bitwise_not',
      [],
      [new CppUnknownExpression(text)],
    ).code();
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

    const concat = new CppCoreFunctionCall(
      'ssc__core__fn__string_concat',
      [],
      [
        new CppUnknownExpression(lowerExpression(node.left, context)),
        new CppUnknownExpression(lowerString(node.right, context)),
      ],
    );

    return `(${target} = ${concat.code()})`;
  }

  const type = getSscNumberType(node.left);
  const common = commonType([...getOperands(node.left), ...getOperands(node.right)]);

  assert(common === type, `${node.location()}: common type ${common} does not match ${type}`);

  const target = lowerVariableReference(node.left, context);
  const current = lowerExpression(node.left, context);
  const right = lowerNumber(node.right, type, context);
  const operator = getCompoundAssignmentOperator(kind);

  return `(${target} = ${getArithmeticText(operator, type, current, right)})`;
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
  if (isUnionStorage(operand, context)) {
    const one = new CppNumericLiteral(type, '1').code();
    const step =
      includes(sscFloatTypes, type) ?
        `previous ${isIncrement ? '+' : '-'} ${one}`
      : new CppCoreFunctionCall(
          isIncrement ? 'ssc__core__fn__add' : 'ssc__core__fn__sub',
          [],
          [
            new CppUnknownExpression('previous'),
            new CppUnknownExpression(one),
            new CppCStringLiteral(type),
          ],
        ).code();
    const result = isPrefix ? 'next' : 'previous';

    return `[&] { const ${CppNode.toCppTypeName(type)} previous = ${lowerExpression(operand, context)}; const ${CppNode.toCppTypeName(type)} next = ${step}; ${target} = next; return ${result}; }()`;
  }

  if (includes(sscFloatTypes, type)) {
    const text = isIncrement ? '++' : '--';

    return isPrefix ? `(${text}${target})` : `(${target}${text})`;
  }

  const functionName = getUpdateFunctionName(isIncrement, isPrefix);
  const args = [new CppUnknownExpression(target), new CppCStringLiteral(type)];

  return new CppCoreFunctionCall(functionName, [], args).code();
}

function getUpdateFunctionName(isIncrement: boolean, isPrefix: boolean): CppCoreFunctionName {
  if (isIncrement && isPrefix) {
    return 'ssc__core__fn__increment_prefix';
  }

  if (isIncrement && !isPrefix) {
    return 'ssc__core__fn__increment_postfix';
  }

  if (!isIncrement && isPrefix) {
    return 'ssc__core__fn__decrement_prefix';
  }

  return 'ssc__core__fn__decrement_postfix';
}

function lowerArithmeticExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;

  if (isStringType(node.getType())) {
    const args = [
      new CppUnknownExpression(lowerString(node.left, context)),
      new CppUnknownExpression(lowerString(node.right, context)),
    ];

    return new CppCoreFunctionCall('ssc__core__fn__string_concat', [], args).code();
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

  const functionName = getArithmeticFunctionName(kind);
  const args = [new CppUnknownExpression(left), new CppUnknownExpression(right)];

  if (
    kind === ast.SyntaxKind.AmpersandToken // &
    || kind === ast.SyntaxKind.BarToken // |
    || kind === ast.SyntaxKind.CaretToken // ^
  ) {
    return new CppCoreFunctionCall(functionName, [], args).code();
  }

  return new CppCoreFunctionCall(functionName, [], [...args, new CppCStringLiteral(type)]).code();
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

function getArithmeticFunctionName(kind: ast.BinaryOperator): CppCoreFunctionName {
  // +
  if (kind === ast.SyntaxKind.PlusToken) {
    return 'ssc__core__fn__add';
  }

  // -
  if (kind === ast.SyntaxKind.MinusToken) {
    return 'ssc__core__fn__sub';
  }

  // *
  if (kind === ast.SyntaxKind.AsteriskToken) {
    return 'ssc__core__fn__mul';
  }

  // /
  if (kind === ast.SyntaxKind.SlashToken) {
    return 'ssc__core__fn__div';
  }

  // %
  if (kind === ast.SyntaxKind.PercentToken) {
    return 'ssc__core__fn__rem';
  }

  // &
  if (kind === ast.SyntaxKind.AmpersandToken) {
    return 'ssc__core__fn__bitwise_and';
  }

  // |
  if (kind === ast.SyntaxKind.BarToken) {
    return 'ssc__core__fn__bitwise_or';
  }

  // ^
  if (kind === ast.SyntaxKind.CaretToken) {
    return 'ssc__core__fn__bitwise_xor';
  }

  // <<
  if (kind === ast.SyntaxKind.LessThanLessThanToken) {
    return 'ssc__core__fn__shift_left';
  }

  // >>
  if (kind === ast.SyntaxKind.GreaterThanGreaterThanToken) {
    return 'ssc__core__fn__shift_right';
  }

  // >>>
  if (kind === ast.SyntaxKind.GreaterThanGreaterThanGreaterThanToken) {
    return 'ssc__core__fn__unsigned_shift_right';
  }

  assertNever(kind as never);
}

function lowerLogicalExpression(node: NodeBinaryExpression, context: LowerContext) {
  const { kind } = node.binaryOperatorToken;
  const typeName = getSscTypeName(node.app, node.getType());

  if (typeName === 'boolean') {
    const left = lowerExpression(node.left, context);
    const right = lowerExpression(node.right, context);

    return `(${left} ${getLogicalOperator(kind)} ${right})`;
  }

  assert(
    typeName !== 'union',
    `${node.location()}: not implemented logical operator with a union result: ${node.getText()}`,
  );

  const type = getSscNumberType(node);
  const left = lowerNumber(node.left, type, context);
  const right = lowerNumber(node.right, type, context);
  const condition = getTruthyCondition(typeName, 'left');

  // &&
  if (kind === ast.SyntaxKind.AmpersandAmpersandToken) {
    return `[&] { const ${CppNode.toCppTypeName(typeName)} left = ${left}; return ${condition} ? ${right} : left; }()`;
  }

  // ||
  if (kind === ast.SyntaxKind.BarBarToken) {
    return `[&] { const ${CppNode.toCppTypeName(typeName)} left = ${left}; return ${condition} ? left : ${right}; }()`;
  }

  assertNever(kind as never);
}

function lowerNullishExpression(node: NodeBinaryExpression, context: LowerContext) {
  const typeName = getSscTypeName(node.app, node.getType());

  assert(
    getSscTypeName(node.app, node.left.getType()) === 'union',
    `${node.location()}: not implemented '??' with a non-union left operand: ${node.getText()}`,
  );

  const left = lowerExpression(node.left, context);
  const right = lowerValueAs(node.right, typeName, context);
  const value = typeName === 'union' ? 'left' : getUnionReadText(typeName, 'left');

  const isUndefined = new CppCoreFunctionCall(
    'ssc__core__fn__union_is_undefined',
    [],
    [new CppUnknownExpression('left')],
  ).code();
  const isNull = new CppCoreFunctionCall(
    'ssc__core__fn__union_is_null',
    [],
    [new CppUnknownExpression('left')],
  ).code();

  return `[&] { const ssc__core__type__union left = ${left}; return ${isUndefined} || ${isNull} ? ${right} : ${value}; }()`;
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
  if (isStringType(node.getType())) {
    return lowerExpression(node, context);
  }

  const args = [new CppUnknownExpression(lowerExpression(node, context))];

  return new CppCoreFunctionCall('ssc__core__fn__to_string', [], args).code();
}

function lowerTemplateExpression(node: NodeTemplateExpression, context: LowerContext) {
  const parts: CppExpression[] = node.head ? [new CppStringLiteral(node.head)] : [];

  for (const { expression, literal } of node.spans) {
    parts.push(new CppUnknownExpression(lowerString(expression, context)));

    if (literal) {
      parts.push(new CppStringLiteral(literal));
    }
  }

  return parts
    .reduce(
      (left, right) => new CppCoreFunctionCall('ssc__core__fn__string_concat', [], [left, right]),
    )
    .code();
}

function lowerPropertyAccessExpression(node: NodePropertyAccessExpression, context: LowerContext) {
  if (isStringType(node.expression.getType()) && node.name === 'length') {
    const args = [new CppUnknownExpression(lowerExpression(node.expression, context))];

    return new CppCoreFunctionCall('ssc__core__fn__string_length', [], args).code();
  }

  if (node.app.checker.isArrayType(node.expression.getType()) && node.name === 'length') {
    return `ssc__core__fn__array_length(${lowerExpression(node.expression, context)})`;
  }

  if (isObjectType(node.app, node.expression.getType())) {
    const text = lowerFieldReference(node, context);
    const fieldTypeName = getShape(node.expression, context).fields.find(
      (f) => f.name === node.name,
    )?.typeName;
    const typeName = getSscTypeName(node.app, node.getType());

    if (fieldTypeName === 'union' && typeName !== 'union') {
      return getUnionReadText(typeName, text);
    }

    return text;
  }

  throw new Error(`${node.location()}: not implemented property: ${node.getText()}`);
}

type Shape = { id: string; structName: string; fields: { name: string; typeName: string }[] };

function getShape(
  node: AbstractNode<ast.Expression>,
  context: LowerContext,
  type = node.getType(),
): Shape {
  const { checker } = node.app;
  const fields = checker
    .getPropertiesOfType(type)
    .map((s) => ({ name: s.name, typeName: getSscTypeName(node.app, checker.getTypeOfSymbol(s)) }))
    .sort((a, b) =>
      a.name < b.name ? -1
      : a.name > b.name ? 1
      : 0,
    );
  const id = getHash(fields.map((f) => `${f.name}:${CppNode.toCppTypeName(f.typeName)}`).join(','));
  const structName = `ssc__ts__shape__${id}`;
  const definitions = context.globalContext.shapeDefinitionMap;

  if (!definitions.has(structName)) {
    const members = fields
      .map((f) => ` ${CppNode.toCppTypeName(f.typeName)} ssc__ts__member__${f.name};`)
      .join('');
    const getOffsets = (typeName: string) =>
      fields
        .filter((f) => f.typeName === typeName)
        .map((f) => `__builtin_offsetof(${structName}, ssc__ts__member__${f.name})`);
    const refOffsets = getOffsets('ref');
    const unionOffsets = getOffsets('union');
    const fieldInfos = fields.map((f) => {
      const kind =
        f.typeName === 'union' ?
          'ssc__core__var__union_kind'
        : `ssc__core__var__type_id<${CppNode.toCppTypeName(f.typeName)}>`;

      return `{"${f.name}", __builtin_offsetof(${structName}, ssc__ts__member__${f.name}), ${kind}}`;
    });
    const defineArray = (suffix: string, type: string, items: string[]) => {
      if (items.length === 0) {
        return '{}';
      }

      definitions.set(
        `${structName}__${suffix}`,
        `inline constexpr ${type} ${structName}__${suffix}[] = {${items.join(', ')}};`,
      );

      return `{${items.length}, ${structName}__${suffix}}`;
    };

    definitions.set(
      structName,
      `struct ${structName} { ssc__core__struct__object_header ssc__core__member__object_header;${members} };`,
    );

    const refs = defineArray('ref_offsets', 'ssc__core__type__u64', refOffsets);
    const unions = defineArray('union_offsets', 'ssc__core__type__u64', unionOffsets);
    const infos = defineArray('fields', 'ssc__core__struct__field', fieldInfos);

    definitions.set(
      `${structName}__shape`,
      `inline constexpr ssc__core__struct__shape ${structName}__shape{${refs}, ${unions}, ${infos}, 0x${id}ull};`,
    );
  }

  return { id, structName, fields };
}

function getDescriptorName(shape: Shape, keys: string[], context: LowerContext) {
  const indices = keys.map((k) => shape.fields.findIndex((f) => f.name === k));
  const name = `${shape.structName}__descriptor__${indices.join('_')}`;
  const definitions = context.globalContext.shapeDefinitionMap;

  if (!definitions.has(name)) {
    const keySpan = indices.length === 0 ? '{}' : `{${indices.length}, ${name}__keys}`;

    if (indices.length !== 0) {
      definitions.set(
        `${name}__keys`,
        `inline constexpr ssc__core__type__u64 ${name}__keys[] = {${indices.join(', ')}};`,
      );
    }

    definitions.set(
      name,
      `inline constexpr ssc__core__struct__descriptor ${name}{__builtin_addressof(${shape.structName}__shape), nullptr, nullptr, ssc__core__fn__object_inspect, ${keySpan}};`,
    );
  }

  return name;
}

function getHash(text: string) {
  let hash = 0xcbf29ce484222325n;

  for (const byte of new TextEncoder().encode(text)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, '0');
}

function lowerObjectLiteralExpression(node: NodeObjectLiteralExpression, context: LowerContext) {
  const contextualType = node.app.checker.getContextualType(node.tsNode);
  const objectTypes = (
    contextualType?.isUnionType() ?
      contextualType.getTypes()
    : [contextualType]).filter((t): t is ts.Type => t !== undefined && isObjectType(node.app, t));
  const [targetType] = objectTypes;
  const shape = getShape(
    node,
    context,
    objectTypes.length === 1 && targetType ? targetType : node.getType(),
  );
  const keys = node.properties.map((p) => p.name);
  const descriptor = getDescriptorName(shape, keys, context);
  const field = (name: string) => `__builtin_addressof(object->ssc__ts__member__${name})`;
  const values = node.properties.map(
    (p) => `ssc__core__fn__construct(${field(p.name)}, ${lowerValue(p.value, context)});`,
  );
  const missings = shape.fields
    .filter((f) => !keys.includes(f.name))
    .map((f) => {
      assert(
        f.typeName === 'union',
        `${node.location()}: not implemented missing property: ${f.name}`,
      );

      return `ssc__core__fn__construct(${field(f.name)}, ssc__core__type__union(${new CppUndefinedLiteral().code()}));`;
    });
  const allocation = `${shape.structName}* object = reinterpret_cast<${shape.structName}*>(ssc__core__fn__allocate_object(sizeof(${shape.structName}), __builtin_addressof(${descriptor})));`;

  return `[&] { ${[allocation, ...values, ...missings].join(' ')} return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }()`;
}

function lowerFieldReference(node: NodePropertyAccessExpression, context: LowerContext) {
  const shape = getShape(node.expression, context);
  const field = shape.fields.find((f) => f.name === node.name);

  assert(field, `${node.location()}: not implemented property: ${node.getText()}`);

  return `ssc__core__fn__field<${CppNode.toCppTypeName(field.typeName)}>(${lowerExpression(node.expression, context)}, 0x${shape.id}ull, __builtin_offsetof(${shape.structName}, ssc__ts__member__${node.name}), "${node.name}")`;
}

function isObjectType(app: AppSourceFile['app'], type: ts.Type) {
  if (isStringType(type) || app.checker.isArrayType(type) || isFunctionType(app, type)) {
    return false;
  }

  if (type.isIntersectionType()) {
    return type.getTypes().every((t) => isTypeFlagMatch(t, ts.TypeFlags.Object));
  }

  return isTypeFlagMatch(type, ts.TypeFlags.Object);
}

function checkSharedRepresentation(node: AbstractNode<ast.Expression>, targetType: ts.Type) {
  if (node instanceof NodeArrayLiteralExpression || node instanceof NodeObjectLiteralExpression) {
    return;
  }

  const { checker } = node.app;
  const sourceType = node.getType();

  assert(
    isSameRepresentation(node.app, sourceType, targetType, new Set()),
    `${node.location()}: '${checker.typeToString(sourceType)}' and '${checker.typeToString(targetType)}' can not share a value because their element or property representations differ, create a new value instead (e.g. 'values.map((value) => value)' or '{ x: value.x }')`,
  );
}

function isSameRepresentation(
  app: AppSourceFile['app'],
  source: ts.Type,
  target: ts.Type,
  visited: Set<string>,
): boolean {
  const { checker } = app;
  const key = `${checker.typeToString(source)}\0${checker.typeToString(target)}`;

  if (visited.has(key)) {
    return true;
  }

  visited.add(key);

  const isSameSlot = (s: ts.Type, t: ts.Type) =>
    getSscTypeName(app, s) === getSscTypeName(app, t) && isSameRepresentation(app, s, t, visited);

  if (source.isUnionType() || target.isUnionType()) {
    const targets = target.isUnionType() ? target.getTypes() : [target];
    const sources = source.isUnionType() ? source.getTypes() : [source];

    return sources
      .filter((s) => checker.isArrayType(s) || isObjectType(app, s))
      .every((s) => targets.some((t) => isSameSlot(s, t)));
  }

  if (checker.isArrayType(source) && checker.isArrayType(target)) {
    const [sourceElement] = checker.getTypeArguments(source as ts.TypeReference);
    const [targetElement] = checker.getTypeArguments(target as ts.TypeReference);

    return !sourceElement || !targetElement || isSameSlot(sourceElement, targetElement);
  }

  if (isObjectType(app, source) && isObjectType(app, target)) {
    const sourceProperties = checker.getPropertiesOfType(source);

    return checker.getPropertiesOfType(target).every((t) => {
      const s = sourceProperties.find((p) => p.name === t.name);

      return !s || isSameSlot(checker.getTypeOfSymbol(s), checker.getTypeOfSymbol(t));
    });
  }

  return true;
}

function lowerTypeOfExpression(node: NodeTypeOfExpression, context: LowerContext) {
  if (isStringType(node.expression.getType())) {
    return new CppStringLiteral('string').code();
  }

  if (node.app.checker.isArrayType(node.expression.getType())) {
    return new CppStringLiteral('object').code();
  }

  if (isFunctionType(node.app, node.expression.getType())) {
    return new CppStringLiteral('function').code();
  }

  const typeName = getSscTypeName(node.app, node.expression.getType());

  if (typeName === 'union') {
    const args = [new CppUnknownExpression(lowerExpression(node.expression, context))];

    return new CppCoreFunctionCall('ssc__core__fn__typeof', [], args).code();
  }

  return new CppStringLiteral(getJsTypeOf(typeName)).code();
}

function lowerConditionalExpression(node: NodeConditionalExpression, context: LowerContext) {
  const typeName = getSscTypeName(node.app, node.getType());
  const condition = lowerCondition(node.condition, context);
  const whenTrue = lowerValueAs(node.whenTrue, typeName, context);
  const whenFalse = lowerValueAs(node.whenFalse, typeName, context);

  return `(${condition} ? ${whenTrue} : ${whenFalse})`;
}

function lowerValueAs(node: AbstractNode<ast.Expression>, typeName: string, context: LowerContext) {
  if (includes(sscNumberTypes, typeName)) {
    return lowerNumber(node, typeName, context);
  }

  const text = lowerExpression(node, context);

  if (typeName === 'union' && getSscTypeName(node.app, node.getType()) !== 'union') {
    return `ssc__core__type__union(${text})`;
  }

  return text;
}

function lowerAsExpression(node: NodeAsExpression, context: LowerContext): string {
  const { expression } = node;

  if (node.isConst) {
    return lowerExpression(expression, context);
  }

  const { checker } = node.app;
  const sourceType = expression.getType();
  const targetType = node.getType();
  const targetName = checker.typeToString(targetType);
  const message = `${node.location()}: 'as' can not convert '${checker.typeToString(sourceType)}' to '${targetName}'`;

  assert(!isTypeFlagMatch(targetType, ts.TypeFlags.AnyOrUnknown), message);

  const target = getSscTypeName(node.app, targetType);
  const isLiteral =
    isTypeFlagMatch(sourceType, ts.TypeFlags.NumberLiteral) || isCharLiteralType(sourceType);

  if (isLiteral && includes(sscNumberTypes, target)) {
    return lowerNumber(expression, target, context);
  }

  const text = lowerExpression(expression, context);
  const source = getSscTypeName(node.app, sourceType);

  if (source === 'union' && target === 'union' && targetType.isUnionType()) {
    const memberNames = getUnionMemberSscTypeNames(node.app, targetType);

    const args = [new CppUnknownExpression(text), new CppCStringLiteral(targetName)];

    return new CppCoreFunctionCall('ssc__core__fn__union_as_union', memberNames, args).code();
  }

  if (source === 'union') {
    const args = [new CppUnknownExpression(text), new CppCStringLiteral(targetName)];

    return new CppCoreFunctionCall('ssc__core__fn__union_as', [target], args).code();
  }

  if (targetType.isUnionType()) {
    assert(isLiteral || getUnionMemberSscTypeNames(node.app, targetType).includes(source), message);

    return `ssc__core__type__union(${text})`;
  }

  assert(source === target, message);

  return text;
}

function getUnionMemberSscTypeNames(app: AppSourceFile['app'], type: ts.UnionType) {
  return [...new Set(type.getTypes().map((t) => getSscTypeName(app, t)))];
}

function getJsTypeOf(typeName: string) {
  if (typeName === 'undefined') {
    return 'undefined';
  }

  if (typeName === 'null') {
    return 'object';
  }

  if (typeName === 'boolean') {
    return 'boolean';
  }

  if (includes(sscNumberTypes, typeName)) {
    return 'number';
  }

  if (typeName === 'ref') {
    return 'object';
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

    const compare = new CppCoreFunctionCall(
      'ssc__core__fn__string_compare',
      [],
      [new CppUnknownExpression(left), new CppUnknownExpression(right)],
    );

    return `(${compare.code()} ${getComparisonOperator(kind)} 0)`;
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

    const args = [new CppUnknownExpression(leftText), new CppUnknownExpression(rightText)];

    return new CppCoreFunctionCall('ssc__core__fn__strict_equals', [], args).code();
  }

  if (
    isTypeFlagMatch(left.getType(), ts.TypeFlags.BooleanLike)
    && isTypeFlagMatch(right.getType(), ts.TypeFlags.BooleanLike)
  ) {
    return `(${lowerExpression(left, context)} == ${lowerExpression(right, context)})`;
  }

  if (
    getSscTypeName(left.app, left.getType()) === 'ref'
    && getSscTypeName(right.app, right.getType()) === 'ref'
  ) {
    const args = [
      new CppUnknownExpression(lowerExpression(left, context)),
      new CppUnknownExpression(lowerExpression(right, context)),
    ];

    return new CppCoreFunctionCall('ssc__core__fn__strict_equals', [], args).code();
  }

  const type = commonType([...getOperands(left), ...getOperands(right)]);

  return `(${lowerNumber(left, type, context)} == ${lowerNumber(right, type, context)})`;
}

function isTypeIdComparison(node: AbstractNode<ast.Expression>) {
  const type = node.getType();

  return (
    isTypeFlagMatch(type, ts.TypeFlags.Undefined | ts.TypeFlags.Null)
    || getSscTypeName(node.app, type) === 'union'
  );
}

function lowerEqualityOperand(
  node: AbstractNode<ast.Expression>,
  other: AbstractNode<ast.Expression>,
  context: LowerContext,
) {
  if (isCharLiteralType(node.getType()) && hasCharMember(node.app, other.getType())) {
    return lowerNumber(node, 'char', context);
  }

  return lowerExpression(node, context);
}

function hasCharMember(app: AppSourceFile['app'], type: ts.Type) {
  return type.isUnionType() && type.getTypes().some((t) => getSscTypeName(app, t) === 'char');
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

  if (!targetType || isTypeFlagMatch(targetType, ts.TypeFlags.AnyOrUnknown)) {
    return lowerExpression(node, context);
  }

  checkSharedRepresentation(node, targetType);

  if (isCharLiteralType(node.getType()) && hasCharMember(node.app, targetType)) {
    return lowerNumber(node, 'char', context);
  }

  const type = getSscTypeName(node.app, targetType);

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

  if (node instanceof NodeAsExpression && node.isConst) {
    return lowerNumber(node.expression, type, context);
  }

  if (node instanceof NodeConditionalExpression) {
    const condition = lowerCondition(node.condition, context);
    const whenTrue = lowerNumber(node.whenTrue, type, context);
    const whenFalse = lowerNumber(node.whenFalse, type, context);

    return `(${condition} ? ${whenTrue} : ${whenFalse})`;
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

    return new CppNumericLiteral(type, String(nodeType.value.codePointAt(0))).code();
  }

  if (isTypeFlagMatch(nodeType, ts.TypeFlags.NumberLiteral)) {
    const value = getNumberLiteralValue(node.app, nodeType);

    assert(
      isLiteralInRange(value, type),
      `${node.location()}: '${node.getText()}' can not be converted to ${type}`,
    );

    if (isEffectiveNumericLiteral(node)) {
      return new CppNumericLiteral(type, value.toFixed()).code();
    }

    return `static_cast<${CppNode.toCppTypeName(type)}>(${lowerExpression(node, context)})`;
  }

  const text = lowerExpression(node, context);

  if (getSscTypeName(node.app, nodeType) === 'union') {
    return new CppCoreFunctionCall(
      'ssc__core__fn__union_to_number',
      [type],
      [new CppUnknownExpression(text)],
    ).code();
  }

  const source = getSscNumberType(node, nodeType);

  if (source === type) {
    return text;
  }

  assert(
    isLossless(source, type),
    `${node.location()}: ${source} can not be converted to ${type} without loss`,
  );

  return `static_cast<${CppNode.toCppTypeName(type)}>(${text})`;
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
  const name = getSscTypeName(node.app, type);

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
  const { topLevelVariableSymbolIdSet, tdzReferenceNodeSet } = context.globalContext.programContext;
  const declaration = node.getValueDeclaration();
  const isSameFile = declaration.getSourceFile().fileName === node.getSourceFile().fileName;

  assert(
    ast.isVariableOrParameterDeclaration(declaration),
    `${node.location()}: '${node.text}' is not a variable identifier`,
  );

  if (isBoxedVariable(node, context)) {
    const capture = { symbolId: node.getSymbol().id, name: node.text };

    return `ssc__core__fn__box_value(${getBoxPointerText(capture, context)})`;
  }

  if (!topLevelVariableSymbolIdSet.has(node.getSymbol().id)) {
    return getVariableReference(node, context).code();
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

  const { identifier } = new NodeVariableDeclaration(node.app, declaration).bindingName;
  const realPath = node.app.parser.tsPathToRealPath(declaration.getSourceFile().fileName);
  const reference = getVariableReference(identifier, context);
  const variableName = reference.code();

  if (!tdzReferenceNodeSet.has(node.tsNode)) {
    return variableName;
  }

  const tdzTagName = reference.tdzTagCode();

  if (!isSameFile) {
    addImportedForward(context, realPath, tdzTagName, `${reference.declaration.tdzTagCode()};`);
  }

  return `(ssc__core__fn__throw_if_tdz(${tdzTagName}, "${node.text}"), ${variableName})`;
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

  const variableDeclaration = declareVariable(identifier, context, 'imported', false);

  addImportedForward(
    context,
    realPath,
    variableDeclaration.reference.code(),
    new CppDeclarationStatement(variableDeclaration).code(),
  );
}

function narrowUnion(node: NodeIdentifier, text: string, context: LowerContext) {
  if (!isUnionStorage(node, context)) {
    return text;
  }

  const typeName = getSscTypeName(node.app, node.getType());

  if (typeName === 'union') {
    return text;
  }

  return getUnionReadText(typeName, text);
}

function isUnionStorage(node: NodeIdentifier, context: LowerContext) {
  const declaredType = node.app.checker.getTypeOfSymbol(node.getSymbol());

  return isBoxedVariable(node, context) || getSscTypeName(node.app, declaredType) === 'union';
}

function getUnionReadText(typeName: string, text: string) {
  const args = [new CppUnknownExpression(text)];

  if (typeName === 'undefined') {
    return new CppCoreFunctionCall('ssc__core__fn__union_to_undefined', [], args).code();
  }

  if (typeName === 'null') {
    return new CppCoreFunctionCall('ssc__core__fn__union_to_null', [], args).code();
  }

  if (includes(sscNumberTypes, typeName)) {
    return new CppCoreFunctionCall('ssc__core__fn__union_to_number', [typeName], args).code();
  }

  if (typeName === 'boolean') {
    return new CppCoreFunctionCall('ssc__core__fn__union_to_boolean', [], args).code();
  }

  if (typeName === 'ref') {
    return new CppCoreFunctionCall('ssc__core__fn__union_to_ref', [], args).code();
  }

  throw new Error(`not implemented union member read: ${typeName}`);
}

function isStringType(type: ts.Type) {
  if (type.isUnionType()) {
    return type.getTypes().every((t) => isTypeFlagMatch(t, ts.TypeFlags.StringLike));
  }

  return isTypeFlagMatch(type, ts.TypeFlags.StringLike);
}

function isFunctionType(app: AppSourceFile['app'], type: ts.Type) {
  return app.checker.getSignaturesOfType(type, ts.SignatureKind.Call).length !== 0;
}

function getSscTypeName(app: AppSourceFile['app'], type: ts.Type): string {
  if (isTypeFlagMatch(type, ts.TypeFlags.Void)) {
    return 'void';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Undefined)) {
    return 'undefined';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Null)) {
    return 'null';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.BooleanLike)) {
    return 'boolean';
  }

  if (isTypeFlagMatch(type, ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return 'f64';
  }

  if (isStringType(type)) {
    return 'ref';
  }

  if (app.checker.isArrayType(type)) {
    return 'ref';
  }

  if (isFunctionType(app, type)) {
    return 'ref';
  }

  // `boolean` is also a `true | false` union, so this must come after the BooleanLike check
  if (type.isUnionType()) {
    return 'union';
  }

  if (isObjectType(app, type)) {
    return 'ref';
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
  assert(
    app.parser.tsPathToRealPath(declarationFile.fileName) === app.preludeSourceFile.realPath,
    `'${symbol.name}' is not the prelude type`,
  );

  return symbol.name;
}
