import * as ast from 'typescript7/unstable/ast';
import { AppSourceFile } from '~/ts/ts-node.js';

type References = {
  variables: Set<number>;
  functions: Set<number>;
};

/**
 * 선언 전(TDZ)에 접근될 수 있는 최상위 변수의 심볼 id. 이 변수들만 초기화 상태를 두고 접근할
 * 때마다 검사한다. 나머지는 검사 없는 전역 변수다.
 *
 * 조건문은 무시하고 실행될 수 있는 경로를 모두 본다. 그래서 놓치는 경우는 없고, 실제로는
 * 선언 뒤에만 호출되는 함수 때문에 검사가 붙는 경우만 있다. 이 판단은 아래 전제에서만 맞다.
 *
 * - 호출은 모두 이름으로 하는 직접 호출이다. 함수 값을 넘기는 기능이 생기면 다시 봐야 한다.
 * - 다른 모듈은 이 모듈의 변수에 닿지 않는다. 순환 import에서는 틀리며 모듈 사이 검사는 아직 없다.
 * - 최상위 코드에서 선언보다 앞서 변수를 직접 쓰면 TS가 오류(TS2448)를 낸다.
 */
export function findTdzVariables(sourceFile: AppSourceFile) {
  const { statements } = sourceFile.tsNode;
  const symbolIdOf = (node: ast.Node) => sourceFile.app.checker.getSymbolAtLocation(node)?.id;

  const variables = new Set<number>();
  const functionBodies = new Map<number, ast.Node>();

  for (const statement of statements) {
    if (ast.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const id = symbolIdOf(declaration.name);

        if (id !== undefined) {
          variables.add(id);
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

  const collect = (node: ast.Node): References => {
    const references: References = { variables: new Set(), functions: new Set() };
    const visit = (child: ast.Node) => {
      if (ast.isIdentifier(child)) {
        const id = symbolIdOf(child);

        if (id !== undefined && variables.has(id)) {
          references.variables.add(id);
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

  // 함수 본문이 직접 닿는 변수와 함수. 호출을 따라가는 건 아래 reachable에서 한다.
  const direct = new Map(functionBodies.entries().map(([id, body]) => [id, collect(body)]));

  /** 문장이 실행될 때 닿을 수 있는 변수. 직접 쓰는 것과, 부르는 함수를 끝까지 따라가 닿는 것. */
  const reachable = (references: References) => {
    const reached = new Set(references.variables);
    const visited = new Set<number>();
    const pending = [...references.functions];

    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
      if (visited.has(id)) {
        continue;
      }

      visited.add(id);

      const body = direct.get(id);

      if (body) {
        body.variables.forEach((v) => reached.add(v));
        pending.push(...body.functions);
      }
    }

    return reached;
  };

  const initialized = new Set<number>();
  const tdzVariables = new Set<number>();
  const check = (node: ast.Node) => {
    for (const id of reachable(collect(node))) {
      if (!initialized.has(id)) {
        tdzVariables.add(id);
      }
    }
  };

  // 최상위 문장을 실행 순서대로 돌며, 아직 초기화되지 않은 변수에 닿는 곳을 찾는다.
  for (const statement of statements) {
    if (ast.isFunctionDeclaration(statement) || ast.isImportDeclaration(statement)) {
      continue;
    }

    if (!ast.isVariableStatement(statement)) {
      check(statement);
      continue;
    }

    // 초깃값을 계산하는 동안 그 변수는 아직 TDZ다. 한 문장의 여러 선언도 앞에서부터 초기화된다.
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

  return tdzVariables;
}
