// TODO: review
import * as ast from 'typescript7/ast';
import { AppSourceFile } from '~/ts/node.js';

export type Capture = { symbolId: number; name: string };

function isFunctionLike(node: ast.Node) {
  return (
    ast.isFunctionDeclaration(node) || ast.isArrowFunction(node) || ast.isFunctionExpression(node)
  );
}

function getEnclosingFunction(node: ast.Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionLike(current)) {
      return current;
    }
  }

  return undefined;
}

export function analyzeClosure(sourceFiles: readonly AppSourceFile[]) {
  const boxedVariableSymbolIdSet = new Set<number>();
  const closureCaptureMap = new Map<ast.Node, Capture[]>();

  for (const { app, tsNode } of sourceFiles) {
    const { checker } = app;
    const functions: ast.Node[] = [];

    const visit = (node: ast.Node) => {
      if (ast.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        const declaration = symbol?.valueDeclaration?.resolve();

        if (symbol && declaration && ast.isVariableOrParameterDeclaration(declaration)) {
          const declaringFunction = getEnclosingFunction(declaration);
          const index = declaringFunction ? functions.indexOf(declaringFunction) : -1;

          if (declaringFunction && index !== -1 && index < functions.length - 1) {
            boxedVariableSymbolIdSet.add(symbol.id);

            for (const closure of functions.slice(index + 1)) {
              const captures = closureCaptureMap.get(closure) || [];

              if (!captures.some((c) => c.symbolId === symbol.id)) {
                captures.push({ symbolId: symbol.id, name: node.text });
              }

              closureCaptureMap.set(closure, captures);
            }
          }
        }
      }

      if (isFunctionLike(node)) {
        functions.push(node);
        node.forEachChild(visit);
        functions.pop();

        return;
      }

      node.forEachChild(visit);
    };

    visit(tsNode);
  }

  return { boxedVariableSymbolIdSet, closureCaptureMap };
}
