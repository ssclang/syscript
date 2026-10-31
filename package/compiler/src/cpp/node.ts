import { assertNever } from '@syscript/share/util';
import { CppWriter } from '~/cpp/writer.js';
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

  static toCppNamespaceName(pathId: string) {
    return `ssc__ts__namespace__${pathId}`;
  }

  static toCppNamespacedName(pathId: string | undefined, cppName: string) {
    if (pathId === undefined) {
      return cppName;
    }

    return `${CppNode.toCppNamespaceName(pathId)}::${cppName}`;
  }

  static toCppVariableName(tsVariableName: string) {
    return `ssc__ts__var__${tsVariableName}`;
  }

  static toCppTdzTagName(tsVariableName: string) {
    return `ssc__ts__tdz__${tsVariableName}`;
  }

  static toCppFunctionName(tsFunctionName: string) {
    return `ssc__ts__fn__${tsFunctionName}`;
  }

  static toCppTypeName(tsTypeName: string) {
    return `ssc__core__type__${tsTypeName}`;
  }
}

export abstract class CppExpression extends CppNode {}

export abstract class CppStatement extends CppNode {}

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

export class CppUnknownDeclaration extends CppNode {
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

export type CppVariableStorage = 'imported' | 'topLevel' | 'exportedTopLevel' | 'local';

export class CppVariableDeclaration extends CppNode {
  readonly pathId?: string;
  readonly storage: CppVariableStorage;
  readonly isConst: boolean;
  readonly tsTypeName: string;
  readonly cppTypeName: string;
  readonly tsVariableName: string;
  readonly cppVariableName: string;
  readonly initializer?: CppExpression;
  readonly reference: CppVariableReference;

  constructor(
    pathId: string | undefined,
    storage: CppVariableStorage,
    isConst: boolean,
    tsTypeName: string,
    tsVariableName: string,
    initializer?: CppExpression,
  ) {
    super();
    this.pathId = pathId;
    this.storage = storage;
    this.isConst = isConst;
    this.tsTypeName = tsTypeName;
    this.cppTypeName = CppNode.toCppTypeName(this.tsTypeName);
    this.tsVariableName = tsVariableName;
    this.cppVariableName = CppNode.toCppVariableName(this.tsVariableName);
    this.initializer = initializer;
    this.reference = new CppVariableReference(this);
  }

  private getLinkage() {
    if (this.storage === 'imported') {
      return 'extern ';
    }

    if (this.storage === 'topLevel') {
      return 'static ';
    }

    if (this.storage === 'exportedTopLevel') {
      return '';
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.storage === 'local') {
      return '';
    }

    assertNever(this.storage);
  }

  code() {
    const tokens: string[] = [];

    if (this.isConst) {
      tokens.push('const');
    }

    tokens.push(this.cppTypeName);
    tokens.push(this.cppVariableName);

    if (this.initializer) {
      tokens.push('=');
      tokens.push(this.initializer.code());
    }

    return `${this.getLinkage()}${tokens.join(' ')}`;
  }

  tdzTagCode() {
    const linkage = this.getLinkage();
    const typeName = CppNode.toCppTypeName('boolean');

    return `${linkage}${typeName} ${CppNode.toCppTdzTagName(this.tsVariableName)}`;
  }
}

export class CppVariableReference extends CppExpression {
  readonly declaration: CppVariableDeclaration;

  constructor(declaration: CppVariableDeclaration) {
    super();
    this.declaration = declaration;
  }

  code() {
    return CppNode.toCppNamespacedName(this.declaration.pathId, this.declaration.cppVariableName);
  }

  tdzTagCode() {
    const { pathId, tsVariableName } = this.declaration;

    return CppNode.toCppNamespacedName(pathId, CppNode.toCppTdzTagName(tsVariableName));
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

// region function

export type CppFunctionStorage = 'imported' | 'topLevel' | 'exportedTopLevel';

export class CppFunctionDeclaration extends CppNode {
  readonly pathId: string;
  readonly storage: CppFunctionStorage;
  readonly isExternC: boolean;
  readonly tsReturnTypeName: string;
  readonly cppReturnTypeName: string;
  readonly tsFunctionName: string;
  readonly cppFunctionName: string;
  readonly parameters: CppVariableDeclaration[];
  readonly reference: CppFunctionReference;

  constructor(
    pathId: string,
    storage: CppFunctionStorage,
    isExternC: boolean,
    tsReturnTypeName: string,
    tsFunctionName: string,
    parameters: CppVariableDeclaration[],
  ) {
    super();
    this.pathId = pathId;
    this.storage = storage;
    this.isExternC = isExternC;
    this.tsReturnTypeName = tsReturnTypeName;
    this.cppReturnTypeName = CppNode.toCppTypeName(this.tsReturnTypeName);
    this.tsFunctionName = tsFunctionName;
    this.cppFunctionName =
      this.isExternC ? this.tsFunctionName : CppNode.toCppFunctionName(this.tsFunctionName);
    this.parameters = parameters;
    this.reference = new CppFunctionReference(this);
  }

  private getLinkage() {
    if (this.isExternC) {
      return 'extern "C" ';
    }

    if (this.storage === 'imported') {
      return '';
    }

    if (this.storage === 'topLevel') {
      return 'static ';
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.storage === 'exportedTopLevel') {
      return '';
    }

    assertNever(this.storage);
  }

  code() {
    const linkage = this.getLinkage();
    const parameters = this.parameters.map((p) => p.code()).join(', ');

    return `${linkage}${this.cppReturnTypeName} ${this.cppFunctionName}(${parameters})`;
  }
}

export class CppFunctionReference extends CppExpression {
  readonly declaration: CppFunctionDeclaration;

  constructor(declaration: CppFunctionDeclaration) {
    super();
    this.declaration = declaration;
  }

  code() {
    return CppNode.toCppNamespacedName(this.declaration.pathId, this.declaration.cppFunctionName);
  }
}

export class CppFunctionCall extends CppExpression {
  readonly reference: CppFunctionReference;
  readonly arguments: CppExpression[];

  constructor(reference: CppFunctionReference, args: CppExpression[]) {
    super();
    this.reference = reference;
    this.arguments = args;
  }

  code() {
    const args = this.arguments.map((a) => a.code()).join(', ');

    return `${this.reference.code()}(${args})`;
  }
}

// region statement

export class CppExpressionStatement extends CppStatement {
  readonly expression: CppExpression;

  constructor(expression: CppExpression) {
    super();
    this.expression = expression;
  }

  code() {
    return `${this.expression.code()};`;
  }
}

export class CppDeclarationStatement extends CppStatement {
  readonly declaration: CppVariableDeclaration | CppFunctionDeclaration | CppUnknownDeclaration;

  constructor(
    declaration: CppVariableDeclaration | CppFunctionDeclaration | CppUnknownDeclaration,
  ) {
    super();
    this.declaration = declaration;
  }

  code() {
    return `${this.declaration.code()};`;
  }
}

export class CppReturnStatement extends CppStatement {
  readonly expression?: CppExpression;

  constructor(expression?: CppExpression) {
    super();
    this.expression = expression;
  }

  code() {
    return this.expression ? `return ${this.expression.code()};` : 'return;';
  }
}

// TODO: support label
export class CppBreakStatement extends CppStatement {
  code() {
    return 'break;';
  }
}

// TODO: support label
export class CppContinueStatement extends CppStatement {
  code() {
    return 'continue;';
  }
}

export class CppBlock extends CppStatement {
  readonly statements: CppStatement[];

  constructor(statements: CppStatement[]) {
    super();
    this.statements = statements;
  }

  code() {
    const w = new CppWriter();

    w.block('', () => this.statements.flatMap((s) => s.code().split('\n')));

    return w.lines().join('\n');
  }
}

export class CppIfStatement extends CppStatement {
  readonly condition: CppExpression;
  readonly statements: CppStatement[];
  readonly elseBranch?: CppIfStatement | CppBlock;

  constructor(
    condition: CppExpression,
    statements: CppStatement[],
    elseBranch?: CppIfStatement | CppBlock,
  ) {
    super();
    this.condition = condition;
    this.statements = statements;
    this.elseBranch = elseBranch;
  }

  code() {
    const w = new CppWriter();

    this.write(w, 'if');

    return w.lines().join('\n');
  }

  private write(w: CppWriter, keyword: 'if' | ' else if') {
    const { elseBranch } = this;

    w.block(`${keyword} (${this.condition.code()})`, () =>
      this.statements.flatMap((s) => s.code().split('\n')),
    );

    if (elseBranch instanceof CppIfStatement) {
      elseBranch.write(w, ' else if');
      return;
    }

    if (elseBranch instanceof CppBlock) {
      w.block(' else', () => elseBranch.statements.flatMap((s) => s.code().split('\n')));
    }
  }
}

export class CppWhileStatement extends CppStatement {
  readonly condition: CppExpression;
  readonly statements: CppStatement[];

  constructor(condition: CppExpression, statements: CppStatement[]) {
    super();
    this.condition = condition;
    this.statements = statements;
  }

  code() {
    const w = new CppWriter();

    w.block(`while (${this.condition.code()})`, () =>
      this.statements.flatMap((s) => s.code().split('\n')),
    );

    return w.lines().join('\n');
  }
}

export class CppForStatement extends CppStatement {
  readonly initializer?: CppVariableDeclaration | CppUnknownDeclaration;
  readonly condition: CppExpression;
  readonly incrementor: CppExpression;
  readonly statements: CppStatement[];

  constructor(
    initializer: CppVariableDeclaration | CppUnknownDeclaration | undefined,
    condition: CppExpression,
    incrementor: CppExpression,
    statements: CppStatement[],
  ) {
    super();
    this.initializer = initializer;
    this.condition = condition;
    this.incrementor = incrementor;
    this.statements = statements;
  }

  code() {
    const initializer = this.initializer ? this.initializer.code() : '';
    const header = `for (${initializer}; ${this.condition.code()}; ${this.incrementor.code()})`;
    const w = new CppWriter();

    w.block(header, () => this.statements.flatMap((s) => s.code().split('\n')));

    return w.lines().join('\n');
  }
}
