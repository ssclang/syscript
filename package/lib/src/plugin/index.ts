/*
 * TypeScript Language Service Plugin.
 *
 * tsc는 `type i32 = number` 별칭을 완전히 지워서 i32와 f64를 구분하지 못한다.
 * 타입 주석은 구문 트리에 남아 있으므로, 그걸 읽어 에디터에 진단을 얹는다.
 *
 * tsserver만 이 플러그인을 읽는다. `tsc` CLI에는 붙지 않는다.
 */

import type ts from 'typescript';

/** prelude가 정의한 숫자 타입 이름. 이 이름끼리는 서로 호환되지 않는다. */
const numericTypeNames = new Set([
  'i8',
  'i16',
  'i32',
  'i64',
  'u8',
  'u16',
  'u32',
  'u64',
  'f32',
  'f64',
]);

const category = 1 satisfies ts.DiagnosticCategory.Error;

type PluginModule = {
  create(info: ts.server.PluginCreateInfo): ts.LanguageService;
};

// tsserver는 CommonJS `module.exports = init`를 기대한다. 지금은 프로그램적 검증만
// 하므로 ESM으로 두고, 에디터에 붙일 때 번들 형식을 맞춘다.
export default function init(modules: { typescript: typeof ts }): PluginModule {
  const tsModule = modules.typescript;

  return {
    create(info) {
      const service = info.languageService;

      return {
        ...service,

        getSemanticDiagnostics(fileName) {
          const original = service.getSemanticDiagnostics(fileName);
          const program = service.getProgram();
          const sourceFile = program?.getSourceFile(fileName);

          if (!program || !sourceFile) {
            return original;
          }

          return [...original, ...collect(tsModule, program, sourceFile)];
        },

        provideInlayHints(fileName, span, preferences) {
          const hints = service.provideInlayHints(fileName, span, preferences);
          const program = service.getProgram();
          const sourceFile = program?.getSourceFile(fileName);

          if (!program || !sourceFile) {
            return hints;
          }

          const checker = program.getTypeChecker();

          return hints.map((hint) => {
            const hasNumber =
              hint.text.includes('number')
              || hint.displayParts?.some((part) => part.text === 'number') === true;

            if (!hasNumber) {
              return hint;
            }

            // 변수 힌트는 식별자 바로 뒤, 반환 타입 힌트는 파라미터 목록의 ) 뒤에 붙는다.
            const node = findNode(sourceFile, hint.position - 1);
            const name =
              node && tsModule.isIdentifier(node) ?
                resolveTypeName(tsModule, checker, node)
              : enclosingFunctionTypeName(tsModule, checker, node);

            if (!name) {
              return hint;
            }

            // 클라이언트가 클릭 가능한 힌트를 쓰면 text가 비고 displayParts를 그린다.
            // 선언 위치를 함께 넣어야 힌트에서 prelude로 이동할 수 있다.
            const location = typeAliasLocation(tsModule, program, name);
            const displayParts = hint.displayParts?.map((part) =>
              part.text === 'number' ? { ...part, text: name, ...location } : part,
            );

            return {
              ...hint,
              text: hint.text.replace('number', name),
              ...(displayParts && { displayParts }),
            };
          });
        },

        getQuickInfoAtPosition(fileName, position) {
          const info = service.getQuickInfoAtPosition(fileName, position);

          if (!info) {
            return info;
          }

          const program = service.getProgram();
          const sourceFile = program?.getSourceFile(fileName);
          const hovered =
            program && sourceFile ?
              hoveredTypeName(tsModule, program, sourceFile, position)
            : undefined;

          if (!hovered) {
            return info;
          }

          const { name, isTypeName } = hovered;

          // 타입 이름 위라면 `type i32 = number` 표시가 이미 정확하다. 설명만 얹는다.
          // 값 위라면 tsc가 `number`로만 보여주므로 주석에 적힌 이름으로 되돌린다.
          const displayParts =
            isTypeName ?
              info.displayParts
            : info.displayParts?.map((part) =>
                part.text === 'number' ? { ...part, text: name } : part,
              );

          return {
            ...info,
            ...(displayParts && { displayParts }),
            documentation: [{ kind: 'text', text: describe(name) }],
          };
        },
      };
    },
  };
}

/** 선언의 타입 주석과 초기화식의 타입 주석이 다르면 알린다. */
function collect(
  tsModule: typeof ts,
  program: ts.Program,
  sourceFile: ts.SourceFile,
): ts.Diagnostic[] {
  const checker = program.getTypeChecker();
  const diagnostics: ts.Diagnostic[] = [];

  const report = (target: ts.Node, code: number, messageText: string) => {
    diagnostics.push({
      file: sourceFile,
      start: target.getStart(sourceFile),
      length: target.getWidth(sourceFile),
      category,
      code,
      messageText,
      source: 'syscript',
    });
  };

  /** 선언된 타입과 넣으려는 값이 맞는지 본다. */
  const checkAssign = (declared: string | undefined, value: ts.Expression) => {
    if (!declared) {
      return;
    }

    const literal = literalOf(tsModule, value);

    if (literal) {
      const problem = literalProblem(declared, literal);

      if (problem) {
        report(value, 900002, problem);
      }

      return;
    }

    const actual = resolveTypeName(tsModule, checker, value);

    if (actual && actual !== declared) {
      report(
        value,
        900001,
        `'${actual}' 값을 '${declared}'에 넣을 수 없습니다. 명시적으로 변환하세요.`,
      );
    }
  };

  const visit = (node: ts.Node) => {
    if (tsModule.isVariableDeclaration(node) && node.type && node.initializer) {
      checkAssign(typeName(tsModule, node.type), node.initializer);
    }

    if (tsModule.isCallExpression(node) && tsModule.isIdentifier(node.expression)) {
      const declaration = checker.getSymbolAtLocation(node.expression)?.declarations?.[0];

      if (declaration && tsModule.isFunctionDeclaration(declaration)) {
        node.arguments.forEach((argument, index) => {
          const parameter = declaration.parameters[index];

          if (parameter?.type) {
            checkAssign(typeName(tsModule, parameter.type), argument);
          }
        });
      }
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);

  return diagnostics;
}

/** 숫자 리터럴. node.text는 double로 정규화되어 64비트 경계에서 정밀도를 잃으므로 원문을 쓴다. */
type Literal = { raw: string; normalized: string; negative: boolean };

function literalOf(tsModule: typeof ts, node: ts.Expression): Literal | undefined {
  if (tsModule.isNumericLiteral(node)) {
    return { raw: node.getText(), normalized: node.text, negative: false };
  }

  if (tsModule.isPrefixUnaryExpression(node) && tsModule.isNumericLiteral(node.operand)) {
    const { operand } = node;

    if (node.operator === tsModule.SyntaxKind.MinusToken) {
      return { raw: operand.getText(), normalized: operand.text, negative: true };
    }

    if (node.operator === tsModule.SyntaxKind.PlusToken) {
      return { raw: operand.getText(), normalized: operand.text, negative: false };
    }
  }

  return undefined;
}

const integerRanges = {
  i8: { min: -128n, max: 127n },
  i16: { min: -32768n, max: 32767n },
  i32: { min: -2147483648n, max: 2147483647n },
  i64: { min: -9223372036854775808n, max: 9223372036854775807n },
  u8: { min: 0n, max: 255n },
  u16: { min: 0n, max: 65535n },
  u32: { min: 0n, max: 4294967295n },
  u64: { min: 0n, max: 18446744073709551615n },
} as const;

const floats = {
  f32: { max: 3.4028234663852886e38, digits: 9 },
  f64: { max: Number.MAX_VALUE, digits: 17 },
} as const;

/** 유효숫자 개수. 앞뒤 0과 소수점, 지수부는 값에 기여하지 않는다. */
function significantDigits(raw: string) {
  const [mantissa = ''] = raw.replaceAll('_', '').toLowerCase().split('e');

  return mantissa.replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length;
}

/** 정수 리터럴이면 정확한 값. 16진수와 자릿수 구분자는 BigInt가 그대로 읽고,
 *  지수 표기는 원문으로 못 읽으므로 tsc가 10진수로 풀어준 값을 쓴다. */
function integerOf({ raw, normalized, negative }: Literal) {
  const digits = raw.replaceAll('_', '');
  const readable =
    /^(\d+|0[xbo][0-9a-f]+)$/i.test(digits) ? digits
    : /^\d+$/.test(normalized) ? normalized
    : undefined;

  if (readable === undefined) {
    return undefined;
  }

  const value = BigInt(readable);

  return negative ? -value : value;
}

/** 범위를 벗어난 값이 실제로 저장될 값. 2의 보수 랩어라운드다. */
function wrap(value: bigint, min: bigint, max: bigint) {
  const size = max - min + 1n;
  const shifted = (((value - min) % size) + size) % size;

  return shifted + min;
}

/** 선언된 타입이 이 리터럴을 표현할 수 있는지 본다. */
function literalProblem(declared: string, literal: Literal) {
  const shown = `${literal.negative ? '-' : ''}${literal.raw}`;

  if (declared === 'f32' || declared === 'f64') {
    const { max, digits } = floats[declared];

    if (Math.abs(Number(literal.raw)) > max) {
      return `${shown}는 '${declared}'에 담기지 않아 무한대가 됩니다. 최대 ±${max}`;
    }

    // 담을 수 있는 자릿수를 넘으면 나머지는 버려진다.
    return significantDigits(literal.raw) > digits ?
        `${shown}는 '${declared}'의 유효숫자 ${digits}자리를 넘어 일부가 버려집니다.`
      : undefined;
  }

  if (!Object.hasOwn(integerRanges, declared)) {
    return undefined;
  }

  const { min, max } = integerRanges[declared as keyof typeof integerRanges];
  const value = integerOf(literal);

  if (value === undefined) {
    return `'${declared}'는 정수 타입입니다. ${shown}는 정수가 아닙니다.`;
  }

  if (value >= min && value <= max) {
    return undefined;
  }

  return (
    `${shown}는 '${declared}'에 담기지 않아 오버플로우가 발생합니다.`
    + ` 범위 ${min} ~ ${max}, 실제 값 ${wrap(value, min, max)}`
  );
}

/** 타입 주석에 적힌 이름. `i32` 같은 참조 타입만 본다. */
function typeName(tsModule: typeof ts, node: ts.TypeNode) {
  if (!tsModule.isTypeReferenceNode(node) || !tsModule.isIdentifier(node.typeName)) {
    return undefined;
  }

  const { text } = node.typeName;

  return numericTypeNames.has(text) ? text : undefined;
}

/** 표현식이 가리키는 선언까지 따라가 타입 주석을 읽는다. 타입 객체에는 남아 있지 않다. */
function resolveTypeName(
  tsModule: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Expression,
  // 재귀 함수에서 같은 선언으로 되돌아오면 끊는다.
  seen = new Set<ts.Node>(),
): string | undefined {
  if (tsModule.isIdentifier(node)) {
    const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0];

    if (!declaration) {
      return undefined;
    }

    if (tsModule.isVariableDeclaration(declaration) || tsModule.isParameter(declaration)) {
      if (declaration.type) {
        return typeName(tsModule, declaration.type);
      }

      // 주석이 없으면 초기화식을 따라간다. tsc의 추론은 number로 지워지므로 직접 한다.
      return declaration.initializer ?
          resolveTypeName(tsModule, checker, declaration.initializer, seen)
        : undefined;
    }

    if (tsModule.isFunctionDeclaration(declaration)) {
      return functionTypeName(tsModule, checker, declaration, seen);
    }

    return undefined;
  }

  if (tsModule.isCallExpression(node) && tsModule.isIdentifier(node.expression)) {
    const declaration = checker.getSymbolAtLocation(node.expression)?.declarations?.[0];

    if (declaration && tsModule.isFunctionDeclaration(declaration)) {
      return functionTypeName(tsModule, checker, declaration, seen);
    }
  }

  // `a + b`처럼 연산 결과도 피연산자 타입을 따른다.
  if (tsModule.isBinaryExpression(node)) {
    return (
      resolveTypeName(tsModule, checker, node.left, seen)
      ?? resolveTypeName(tsModule, checker, node.right, seen)
    );
  }

  return undefined;
}

/** 반환 타입 주석이 없으면 return 문에서 읽는다. 전부 같을 때만 인정한다. */
function functionTypeName(
  tsModule: typeof ts,
  checker: ts.TypeChecker,
  declaration: ts.FunctionDeclaration,
  seen = new Set<ts.Node>(),
) {
  if (declaration.type) {
    return typeName(tsModule, declaration.type);
  }

  if (seen.has(declaration)) {
    return undefined;
  }

  seen.add(declaration);

  const names = new Set<string>();

  const visit = (node: ts.Node) => {
    // 중첩 함수의 return은 이 함수 것이 아니다.
    if (tsModule.isFunctionLike(node) && node !== declaration) {
      return;
    }

    if (tsModule.isReturnStatement(node) && node.expression) {
      // 재귀 호출처럼 해석되지 않는 경로는 건너뛴다.
      const name = resolveTypeName(tsModule, checker, node.expression, seen);

      if (name !== undefined) {
        names.add(name);
      }
    }

    node.forEachChild(visit);
  };

  if (declaration.body) {
    visit(declaration.body);
  }

  const [only] = names;

  return names.size === 1 ? only : undefined;
}

/** 커서 위치의 식별자가 가리키는 타입 이름. 타입 이름 자체에 올린 경우도 포함한다. */
function hoveredTypeName(
  tsModule: typeof ts,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  position: number,
) {
  const node = findNode(sourceFile, position);

  if (!node || !tsModule.isIdentifier(node)) {
    return undefined;
  }

  if (numericTypeNames.has(node.text)) {
    return { name: node.text, isTypeName: true };
  }

  const checker = program.getTypeChecker();
  const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0];
  const name =
    declaration && tsModule.isFunctionDeclaration(declaration) ?
      functionTypeName(tsModule, checker, declaration)
    : resolveTypeName(tsModule, checker, node);

  return name === undefined ? undefined : { name, isTypeName: false };
}

/** prelude에 선언된 타입 별칭의 위치. 인레이 힌트에서 정의로 이동할 때 쓴다. */
function typeAliasLocation(tsModule: typeof ts, program: ts.Program, name: string) {
  for (const sourceFile of program.getSourceFiles()) {
    for (const statement of sourceFile.statements) {
      if (tsModule.isTypeAliasDeclaration(statement) && statement.name.text === name) {
        return {
          file: sourceFile.fileName,
          span: {
            start: statement.name.getStart(sourceFile),
            length: statement.name.getWidth(sourceFile),
          },
        };
      }
    }
  }

  return undefined;
}

/** 반환 타입 힌트 자리에서 감싸는 함수를 찾아 반환 타입 이름을 해석한다. */
function enclosingFunctionTypeName(
  tsModule: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Node | undefined,
) {
  for (let current = node; current; current = current.parent as ts.Node | undefined) {
    if (tsModule.isFunctionDeclaration(current)) {
      return current.type ? undefined : functionTypeName(tsModule, checker, current);
    }
  }

  return undefined;
}

function findNode(node: ts.Node, position: number): ts.Node | undefined {
  if (position < node.getStart() || position >= node.getEnd()) {
    return undefined;
  }

  return node.forEachChild((child) => findNode(child, position)) ?? node;
}

function describe(name: string) {
  const bits = Number(name.slice(1));

  if (name.startsWith('f')) {
    return `${bits}비트 부동소수. syscript 기본 숫자 타입은 f64다.`;
  }

  const signed = name.startsWith('i');
  const max = 2n ** BigInt(signed ? bits - 1 : bits) - 1n;
  const min = signed ? -(2n ** BigInt(bits - 1)) : 0n;

  return `${bits}비트 ${signed ? '부호 있는' : '부호 없는'} 정수. ${min} ~ ${max}`;
}
