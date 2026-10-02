import { assert } from '@syscript/share';

/**
 * C 텍스트를 만드는 최소 빌더. IR과 달리 제어 흐름이 구조적이라 블록·종결자 개념이 없고,
 * 표현식은 중첩이 되므로 문자열을 그대로 돌려준다.
 */
export class CWriter {
  private readonly lines: string[] = [];
  private depth = 0;

  line(text: string) {
    this.lines.push(text ? '  '.repeat(this.depth) + text : '');
  }

  indent() {
    this.depth += 1;
  }

  dedent() {
    assert(this.depth > 0);
    this.depth -= 1;
  }

  render() {
    return this.lines.join('\n');
  }
}

export class CModule {
  private readonly declarations: string[] = [];
  private readonly definitions: string[] = [];
  private readonly declared = new Set<string>();

  constructor(readonly name: string) {}

  /** 같은 심볼을 여러 번 부를 수 있으므로 선언은 한 번만 낸다. */
  declare(name: string, signature: string) {
    if (this.declared.has(name)) {
      return;
    }

    this.declared.add(name);
    this.declarations.push(`${signature};`);
  }

  define(text: string) {
    this.definitions.push(text);
  }

  render(headerPaths: readonly string[]) {
    return `
// ${this.name}

// include
${headerPaths.map((h) => `#include "${h}"`).join('\n')}
// /include

// #pragma STDC FP_CONTRACT OFF
// #pragma clang fp contract(off)

// declaration
${this.declarations.join('\n')}
// /declaration

// definition
${this.definitions.join('\n\n')}
// /definition
`.trim();
  }
}

/** 이항과 같은 이유로 감싼다. `- -x`가 `--x`로 붙어버리는 것도 이걸로 막힌다. */
export function unary(operator: string, operand: string) {
  return `(${operator}${operand})`;
}

/** C의 우선순위 규칙에 기대지 않으려고 이항 연산은 항상 괄호로 감싼다. */
export function binary(left: string, operator: string, right: string) {
  return `(${left} ${operator} ${right})`;
}

export function call(callee: string, args: readonly string[]) {
  return `${callee}(${args.join(', ')})`;
}

export function cast(type: string, value: string) {
  return `(${type})${value}`;
}

export function signature(linkage: 'static' | '', name: string, ret: string, params: string) {
  return `${linkage ? `${linkage} ` : ''}${ret} ${name}(${params})`;
}
