// TODO: review
import { assertNever } from '@syscript/share/util';
import * as ast from 'typescript7/ast';
import { AppSourceFile } from '~/ts/node.js';

export type Capture = { kind: 'variable'; symbolId: number; name: string } | { kind: 'this' };

export function isSameCapture(left: Capture, right: Capture) {
  if (left.kind === 'variable') {
    return right.kind === 'variable' && left.symbolId === right.symbolId;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (left.kind === 'this') {
    return right.kind === 'this';
  }

  assertNever(left);
}

function getEnclosingFunction(node: ast.Node) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  for (let current = node.parent; current; current = current.parent) {
    if (ast.isFunctionLikeDeclaration(current)) {
      return current;
    }
  }

  return undefined;
}

export function analyzeClosure(sourceFiles: readonly AppSourceFile[]) {
  const boxedVariableSymbolIdSet = new Set<number>();
  const closureCaptureMap = new Map<ast.Node, Capture[]>();

  const addCapture = (closure: ast.Node, capture: Capture) => {
    const captures = closureCaptureMap.get(closure) || [];

    if (!captures.some((c) => isSameCapture(c, capture))) {
      captures.push(capture);
    }

    closureCaptureMap.set(closure, captures);
  };

  for (const { app, tsNode } of sourceFiles) {
    const { checker } = app;

    const visit = (node: ast.Node) => {
      if (ast.isThisExpression(node)) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        for (let current = node.parent; current; current = current.parent) {
          if (ast.isArrowFunction(current)) {
            addCapture(current, { kind: 'this' });
          } else if (ast.isFunctionLikeDeclaration(current)) {
            break;
          }
        }
      }

      if (ast.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        const declaration = symbol?.valueDeclaration?.resolve();

        if (symbol && declaration && ast.isVariableOrParameterDeclaration(declaration)) {
          const declaringFunction = getEnclosingFunction(declaration);

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          for (let current = node.parent; current; current = current.parent) {
            if (current === declaringFunction) {
              break;
            }

            if (ast.isFunctionLikeDeclaration(current)) {
              addCapture(current, { kind: 'variable', symbolId: symbol.id, name: node.text });
              boxedVariableSymbolIdSet.add(symbol.id);
            }
          }
        }
      }

      node.forEachChild(visit);
    };

    visit(tsNode);
  }

  return { boxedVariableSymbolIdSet, closureCaptureMap };
}
