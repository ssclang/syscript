import { assertNever } from '@syscript/share/util';
import { SscNumberType } from '~/ssc/type.js';

let currentId = 0;

function generateId(): number {
  return currentId++;
}

export abstract class CppNode {
  readonly id: number;

  constructor() {
    this.id = generateId();
  }

  abstract code(): string;

  static toCppVariableName(tsVariableName: string) {
    return `ssc__ts__var__${tsVariableName}`;
  }

  static toCppTypeName(tsTypeName: string) {
    return `ssc__core__type__${tsTypeName}`;
  }
}

export abstract class CppExpression extends CppNode {}

export class CppUnknownExpression extends CppExpression {
  readonly text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  code() {
    return this.text;
  }
}

// region variable

export class CppVariableDeclaration extends CppNode {
  readonly isConst: boolean;
  readonly ref: CppVariableReference;
  readonly initializer?: CppExpression;

  constructor(isConst: boolean, ref: CppVariableReference, initializer?: CppExpression) {
    super();
    this.isConst = isConst;
    this.ref = ref;
    this.initializer = initializer;
  }

  code() {
    const tokens: string[] = [];

    if (this.isConst) {
      tokens.push('const');
    }

    tokens.push(this.ref.cppTypeName);
    tokens.push(this.ref.cppVariableName);

    if (this.initializer) {
      tokens.push('=');
      tokens.push(this.initializer.code());
    }

    return tokens.join(' ');
  }
}

export class CppVariableReference extends CppExpression {
  readonly tsTypeName: string;
  readonly tsVariableName: string;

  readonly cppTypeName: string;
  readonly cppVariableName: string;

  constructor(tsTypeName: string, tsVariableName: string) {
    super();
    this.tsTypeName = tsTypeName;
    this.tsVariableName = tsVariableName;
    this.cppTypeName = CppNode.toCppTypeName(this.tsTypeName);
    this.cppVariableName = CppNode.toCppVariableName(this.tsVariableName);
  }

  code() {
    return this.cppVariableName;
  }
}

// region literal

export class CppUndefinedLiteral extends CppExpression {
  code() {
    return 'ssc__core__var__undefined';
  }
}

export class CppNullLiteral extends CppExpression {
  code() {
    return 'ssc__core__var__null';
  }
}

export class CppBooleanLiteral extends CppExpression {
  readonly value: boolean;

  constructor(value: boolean) {
    super();
    this.value = value;
  }

  code() {
    if (this.value) {
      return 'true';
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.value) {
      return 'false';
    }

    assertNever(this.value);
  }
}

export class CppNumericLiteral extends CppExpression {
  readonly tsTypeName: SscNumberType;
  readonly cppTypeName: string;
  readonly value: string;

  constructor(tsTypeName: SscNumberType, value: string) {
    super();
    this.tsTypeName = tsTypeName;
    this.cppTypeName = CppNode.toCppTypeName(this.tsTypeName);
    this.value = value;
  }

  code() {
    const type = this.tsTypeName;

    if (type === 'i8' || type === 'i16' || type === 'i32' || type === 'i64') {
      const value = this.value === '-9223372036854775808' ? '-9223372036854775807 - 1' : this.value;
      return `${this.cppTypeName}{${value}}`;
    }

    if (type === 'u8' || type === 'u16' || type === 'u32' || type === 'u64' || type === 'char') {
      return `${this.cppTypeName}{${this.value}u}`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (type === 'f32' || type === 'f64') {
      const suffix = type === 'f32' ? 'f' : '';
      const number = type === 'f32' ? Math.fround(Number(this.value)) : Number(this.value);

      if (!Number.isFinite(number)) {
        return `${this.cppTypeName}{${number < 0 ? '-' : ''}__builtin_inf${suffix}()}`;
      }

      const float = this.value.includes('.') ? this.value : `${this.value}.0`;

      return `${this.cppTypeName}{${float}${suffix}}`;
    }

    assertNever(type);
  }
}

export class CppStringLiteral extends CppExpression {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  code() {
    const bytes = new TextEncoder().encode(this.value);
    const text = Array.from(bytes, (b) => {
      if (0x20 <= b && b < 0x7f && b !== 0x22 && b !== 0x5c && b !== 0x3f) {
        return String.fromCharCode(b);
      }

      return `\\${b.toString(8).padStart(3, '0')}`;
    }).join('');

    return `ssc__core__fn__string_literal<u8"${text}">()`;
  }
}
