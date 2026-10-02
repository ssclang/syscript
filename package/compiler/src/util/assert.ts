import { assert } from '@syscript/share';
import * as ast from 'typescript7/unstable/ast';

/**
 * 기대한 종류의 노드인지 확인한다. `ast.isBlock` 같은 타입 가드를 그대로 넘기면
 * 가드 이름으로 기대값을, `SyntaxKind`로 실제값을 메시지에 담는다.
 */
export function assertExpectedNode<T extends ast.Node>(
  node: ast.Node | undefined,
  is: (node: ast.Node) => node is T,
): asserts node is T {
  assert(node, `${is.name} expected, but missing node`);
  assert(is(node), `${is.name} expected, but ${ast.SyntaxKind[node.kind]}: ${node.getText()}`);
}
