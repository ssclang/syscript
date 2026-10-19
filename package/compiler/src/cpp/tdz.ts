// TODO: review
import * as ast from 'typescript7/ast';
import * as ts from 'typescript7/sync';
import { AppSourceFile, isSymbolFlagMatch } from '~/ts/node.js';

type References = {
  variables: Map<ast.Node, number>;
  functions: Set<number>;
};

export function analyzeTdz(sourceFiles: readonly AppSourceFile[]) {
  const topLevelVariableSymbolIdSet = new Set<number>();
  const functionBodies = new Map<number, ast.Node>();
  const initialized = new Set<number>();
  const tdzVariableSymbolIdSet = new Set<number>();
  const tdzReferenceNodeSet = new Set<ast.Node>();
  const [first] = sourceFiles;

  if (!first) {
    return { topLevelVariableSymbolIdSet, tdzVariableSymbolIdSet, tdzReferenceNodeSet };
  }

  const { checker } = first.app;

  const symbolIdOf = (node: ast.Node) => {
    const symbol = checker.getSymbolAtLocation(node);

    if (!symbol) {
      return undefined;
    }

    return isSymbolFlagMatch(symbol, ts.SymbolFlags.Alias) ?
        checker.getAliasedSymbol(symbol).id
      : symbol.id;
  };

  for (const { tsNode } of sourceFiles) {
    for (const statement of tsNode.statements) {
      if (ast.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const id = symbolIdOf(declaration.name);

          if (id !== undefined) {
            topLevelVariableSymbolIdSet.add(id);
          }
        }
      }

      if (ast.isFunctionDeclaration(statement) && statement.name && statement.body) {
        const id = symbolIdOf(statement.name);

        if (id !== undefined) {
          functionBodies.set(id, statement.body);
        }
      }
    }
  }

  const collect = (node: ast.Node): References => {
    const references = {
      variables: new Map<ast.Node, number>(),
      functions: new Set<number>(),
    } as const satisfies References;
    const visit = (child: ast.Node) => {
      if (ast.isIdentifier(child)) {
        const id = symbolIdOf(child);

        if (id !== undefined && topLevelVariableSymbolIdSet.has(id)) {
          references.variables.set(child, id);
        }

        if (id !== undefined && functionBodies.has(id)) {
          references.functions.add(id);
        }
      }

      child.forEachChild(visit);
    };

    visit(node);

    return references;
  };

  const direct = new Map(functionBodies.entries().map(([id, body]) => [id, collect(body)]));

  const reachable = (references: References) => {
    const reached = new Map(references.variables);
    const visited = new Set<number>();
    const pending = [...references.functions];

    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
      if (visited.has(id)) {
        continue;
      }

      visited.add(id);

      const body = direct.get(id);

      if (body) {
        body.variables.forEach((id, node) => reached.set(node, id));
        pending.push(...body.functions);
      }
    }

    return reached;
  };

  const check = (node: ast.Node) => {
    for (const [reference, id] of reachable(collect(node))) {
      if (!initialized.has(id)) {
        tdzVariableSymbolIdSet.add(id);
        tdzReferenceNodeSet.add(reference);
      }
    }
  };

  for (const { tsNode } of sourceFiles) {
    for (const statement of tsNode.statements) {
      if (ast.isFunctionDeclaration(statement) || ast.isImportDeclaration(statement)) {
        continue;
      }

      if (!ast.isVariableStatement(statement)) {
        check(statement);
        continue;
      }

      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer) {
          check(declaration.initializer);
        }

        const id = symbolIdOf(declaration.name);

        if (id !== undefined) {
          initialized.add(id);
        }
      }
    }
  }

  return { topLevelVariableSymbolIdSet, tdzVariableSymbolIdSet, tdzReferenceNodeSet };
}
