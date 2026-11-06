import { assertNever } from '@syscript/share/util';
import { CppBuiltinFunctionName, CppCoreFunctionName } from '~/cpp/core.js';
import { CppWriter } from '~/cpp/writer.js';
import { SscNumberType } from '~/ssc/type.js';

let nodeIdCounter = 0;

function generateId(): number {
  return ++nodeIdCounter;
}

function escapeChar(chars: readonly string[], index: number) {
  const c = chars[index] ?? '';
  const maybeTrigraphStart =
    c === '?' && chars[index + 1] === '?' && chars[index + 2] !== undefined;

  if (c === '"' || c === '\\' || c === '\n' || c === '\r' || c === '\0' || maybeTrigraphStart) {
    return `\\${c.charCodeAt(0).toString(8).padStart(3, '0')}`;
  }

  return c;
}

function escapeStringLiteral(value: string) {
  const chars = Array.from(value);

  return chars.map((_, index) => escapeChar(chars, index)).join('');
}

function escapeUtf16StringLiteral(value: string) {
  const chars = Array.from(value);
  let text = '';
  let isAfterHexEscape = false;

  chars.forEach((c, index) => {
    const code = c.charCodeAt(0);

    if (c.length === 1 && code >= 0xd800 && code <= 0xdfff) {
      text += `\\x${code.toString(16)}`;
      isAfterHexEscape = true;
      return;
    }

    const escaped = escapeChar(chars, index);

    if (isAfterHexEscape && /^[0-9a-fA-F]/.test(escaped)) {
      text += '" u"';
    }

    text += escaped;
    isAfterHexEscape = false;
  });

  return text;
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

  static toCppClassName(tsClassName: string) {
    return `ssc__ts__class__${tsClassName}`;
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
    if (type === 'f32' || type === 'f64' || type === 'number') {
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
    return `ssc__core__fn__string_literal<u"${escapeUtf16StringLiteral(this.value)}">()`;
  }
}

export class CppBStringLiteral extends CppExpression {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  code() {
    return `ssc__core__fn__bstring_literal<u8"${escapeStringLiteral(this.value)}">()`;
  }
}

export class CppCStringLiteral extends CppExpression {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  code() {
    return `"${escapeStringLiteral(this.value)}"`;
  }
}

// region function

export type CppFunctionStorage = 'imported' | 'topLevel' | 'exportedTopLevel';

export class CppFunctionDeclaration extends CppNode {
  readonly pathId: string;
  readonly classDeclaration: CppClassDeclaration | undefined;
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
    classDeclaration: CppClassDeclaration | undefined,
    storage: CppFunctionStorage,
    isExternC: boolean,
    tsReturnTypeName: string,
    tsFunctionName: string,
    parameters: CppVariableDeclaration[],
  ) {
    super();
    this.pathId = pathId;
    this.classDeclaration = classDeclaration;
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
    const { pathId, classDeclaration, cppFunctionName } = this.declaration;

    if (classDeclaration) {
      return `${classDeclaration.reference.code()}::${cppFunctionName}`;
    }

    return CppNode.toCppNamespacedName(pathId, cppFunctionName);
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

// region member

export type CppMember = { tsMemberName: string; initializer: string };

export class CppMemberTableDefinition extends CppNode {
  readonly tableName: string;
  readonly members: CppMember[];
  readonly hashShift: bigint;
  readonly slotCount: number;

  constructor(tableName: string, members: CppMember[]) {
    super();
    this.tableName = tableName;
    this.members = members;

    const hashes = this.members.map((m) => CppMemberTableDefinition.getMemberHash(m.tsMemberName));

    for (let slotCount = 1; ; slotCount *= 2) {
      if (slotCount < hashes.length) {
        continue;
      }

      for (let hashShift = 0n; hashShift < 64n; hashShift++) {
        const slots = hashes.map((h) => (h >> hashShift) & BigInt(slotCount - 1));

        if (new Set(slots).size === slots.length) {
          this.hashShift = hashShift;
          this.slotCount = slotCount;

          return;
        }
      }
    }
  }

  static getMemberHash(tsMemberName: string) {
    let hash = 0xcbf29ce484222325n;

    for (const byte of new TextEncoder().encode(tsMemberName)) {
      hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
    }

    return hash;
  }

  static toCppMemberHash(tsMemberName: string) {
    return `0x${CppMemberTableDefinition.getMemberHash(tsMemberName).toString(16).padStart(16, '0')}ull`;
  }

  lines() {
    const entries = Array.from({ length: this.slotCount }, () => '{0, nullptr}');

    for (const m of this.members) {
      const slot =
        (CppMemberTableDefinition.getMemberHash(m.tsMemberName) >> this.hashShift)
        & BigInt(this.slotCount - 1);

      entries[Number(slot)] = m.initializer;
    }

    const w = new CppWriter();

    w.block(`inline constexpr ssc__core__struct__member ${this.tableName}[] =`, () =>
      entries.map((e) => `${e},`),
    );
    w.inline(';');

    return w.lines();
  }

  descriptorField() {
    return `{${this.hashShift}, {${this.slotCount}, ${this.tableName}}}`;
  }

  code() {
    return this.lines().join('\n');
  }
}

// region shape

export type CppShapeProperty = { tsPropertyName: string; tsTypeName: string };

export class CppShapeDefinition extends CppNode {
  readonly structName: string;
  readonly properties: CppShapeProperty[];
  readonly shapeId: string;
  readonly memberTable: CppMemberTableDefinition;

  constructor(properties: CppShapeProperty[]) {
    super();
    this.properties = properties;
    this.shapeId = CppShapeDefinition.getShapeId(this.properties);
    this.structName = `ssc__ts__shape__${this.shapeId}`;
    this.memberTable = new CppMemberTableDefinition(
      `${this.structName}__member_slots`,
      this.properties.map((p) => this.getFieldMember(p.tsPropertyName)),
    );
  }

  getFieldMember(tsPropertyName: string): CppMember {
    return {
      tsMemberName: tsPropertyName,
      initializer: `{__builtin_offsetof(${this.structName}, ssc__ts__member__${tsPropertyName}), nullptr}`,
    };
  }

  static getShapeId(properties: CppShapeProperty[]) {
    const text = properties
      .map((p) => `${p.tsPropertyName}:${CppNode.toCppTypeName(p.tsTypeName)}`)
      .join(',');
    let hash = 0xcbf29ce484222325n;

    for (const byte of new TextEncoder().encode(text)) {
      hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
    }

    return hash.toString(16).padStart(16, '0');
  }

  lines() {
    const { structName, properties } = this;
    const w = new CppWriter();
    const members = properties.map(
      (p) => `${CppNode.toCppTypeName(p.tsTypeName)} ssc__ts__member__${p.tsPropertyName};`,
    );
    const getOffsets = (tsTypeName: string) =>
      properties
        .filter((p) => p.tsTypeName === tsTypeName)
        .map((p) => `__builtin_offsetof(${structName}, ssc__ts__member__${p.tsPropertyName})`);
    const propertyInfos = properties.map((p) => {
      const kind =
        p.tsTypeName === 'union' ?
          'ssc__core__var__union_kind'
        : `ssc__core__var__type_id<${CppNode.toCppTypeName(p.tsTypeName)}>`;

      return `{"${p.tsPropertyName}", __builtin_offsetof(${structName}, ssc__ts__member__${p.tsPropertyName}), ${kind}}`;
    });
    const defineArray = (suffix: string, type: string, items: string[]) => {
      if (items.length === 0) {
        return '{}';
      }

      w.newline();
      w.block(`inline constexpr ${type} ${structName}__${suffix}[] =`, () =>
        items.map((i) => `${i},`),
      );
      w.inline(';');

      return `{${items.length}, ${structName}__${suffix}}`;
    };

    w.block(`struct ${structName}`, () => [
      'ssc__core__struct__object_header ssc__core__member__object_header;',
      ...members,
    ]);
    w.inline(';');

    const refs = defineArray('ref_offsets', 'ssc__core__type__u64', getOffsets('ref'));
    const unions = defineArray('union_offsets', 'ssc__core__type__u64', getOffsets('union'));
    const infos = defineArray('properties', 'ssc__core__struct__property', propertyInfos);

    w.newline();
    w.block(`inline constexpr ssc__core__struct__shape ${structName}__shape`, () =>
      [refs, unions, infos, `0x${this.shapeId}ull`].map((i) => `${i},`),
    );
    w.inline(';');

    for (const line of this.memberTable.lines()) {
      w.newline(line);
    }

    return w.lines();
  }

  code() {
    return this.lines().join('\n');
  }
}

// region class

export type CppMethod = { tsMethodName: string; declaration: CppFunctionDeclaration };

export class CppClassDeclaration extends CppNode {
  readonly pathId: string;
  readonly tsClassName: string;
  readonly cppClassName: string;
  readonly superClassDeclaration: CppClassDeclaration | undefined;
  readonly shapeDefinition: CppShapeDefinition;
  readonly functionDeclarations: CppFunctionDeclaration[] = [];
  readonly reference: CppClassReference;

  constructor(
    pathId: string,
    tsClassName: string,
    superClassDeclaration: CppClassDeclaration | undefined,
    properties: CppShapeProperty[],
  ) {
    super();
    this.pathId = pathId;
    this.tsClassName = tsClassName;
    this.cppClassName = CppNode.toCppClassName(this.tsClassName);
    this.superClassDeclaration = superClassDeclaration;
    this.shapeDefinition = new CppShapeDefinition([
      ...(superClassDeclaration?.shapeDefinition.properties ?? []),
      ...properties,
    ]);
    this.reference = new CppClassReference(this);
  }

  declareFunction(
    storage: CppFunctionStorage,
    tsReturnTypeName: string,
    tsFunctionName: string,
    parameters: CppVariableDeclaration[],
  ) {
    const declaration = this.functionDeclarations.find((d) => d.tsFunctionName === tsFunctionName);

    if (declaration) {
      return declaration;
    }

    const newDeclaration = new CppFunctionDeclaration(
      this.pathId,
      this,
      storage,
      false,
      tsReturnTypeName,
      tsFunctionName,
      parameters,
    );

    this.functionDeclarations.push(newDeclaration);

    return newDeclaration;
  }

  getMethods(): CppMethod[] {
    const ownMethods = this.functionDeclarations.filter((d) => d.tsFunctionName !== 'constructor');
    const methods = (this.superClassDeclaration?.getMethods() ?? []).filter(
      (m) => !ownMethods.some((d) => d.tsFunctionName === m.tsMethodName),
    );

    return [
      ...methods,
      ...ownMethods.map((declaration) => ({
        tsMethodName: declaration.tsFunctionName,
        declaration,
      })),
    ];
  }

  getMemberTable() {
    return new CppMemberTableDefinition('ssc__ts__member_slots', [
      ...this.shapeDefinition.properties.map((p) =>
        this.shapeDefinition.getFieldMember(p.tsPropertyName),
      ),
      ...this.getMethods().map(({ tsMethodName, declaration }) => ({
        tsMemberName: tsMethodName,
        initializer: `{0, __builtin_addressof(${declaration.classDeclaration?.reference.code()}::ssc__ts__value__${tsMethodName})}`,
      })),
    ]);
  }

  code() {
    const keys = this.shapeDefinition.properties.map((_, index) => index);
    const keySpan = keys.length === 0 ? '{}' : `{${keys.length}, ssc__ts__descriptor__keys}`;
    const className = new CppCStringLiteral(this.tsClassName).code();
    const superClassDescriptor =
      this.superClassDeclaration ?
        `__builtin_addressof(${this.superClassDeclaration.reference.code()}::ssc__ts__descriptor)`
      : 'nullptr';
    const memberTable = this.getMemberTable();
    const ownMethods = this.functionDeclarations.filter((d) => d.tsFunctionName !== 'constructor');
    const w = new CppWriter();

    w.block(`namespace ${this.cppClassName}`, () => {
      const descriptorWriter = new CppWriter();

      if (keys.length !== 0) {
        descriptorWriter.block(
          'inline constexpr ssc__core__type__u64 ssc__ts__descriptor__keys[] =',
          () => keys.map((k) => `${k},`),
        );
        descriptorWriter.inline(';');
        descriptorWriter.newline();
      }

      descriptorWriter.block(
        'inline constexpr ssc__core__struct__descriptor ssc__ts__descriptor',
        () =>
          [
            `__builtin_addressof(${this.shapeDefinition.structName}__shape)`,
            'nullptr',
            'nullptr',
            'ssc__core__fn__object_inspect',
            keySpan,
            className,
            superClassDescriptor,
            memberTable.descriptorField(),
          ].map((i) => `${i},`),
      );
      descriptorWriter.inline(';');

      return [
        ...this.shapeDefinition.lines(),
        ...this.functionDeclarations.map((d) => new CppDeclarationStatement(d).code()),
        ...ownMethods.flatMap((d) => CppClassDeclaration.methodValueLines(d)),
        ...memberTable.lines(),
        ...descriptorWriter.lines(),
      ];
    });

    return w.code();
  }

  private static methodValueLines(declaration: CppFunctionDeclaration) {
    const parameters = declaration.parameters.slice(1);
    const lambdaParameters = [
      'const ssc__core__struct__closure*',
      'ssc__core__type__ref ssc__ts__var__this',
      ...parameters.map((p, index) => `${p.cppTypeName} ssc__core__var__argument_${index}`),
    ];
    const args = [
      'ssc__ts__var__this',
      ...parameters.map((_, index) => `ssc__core__var__argument_${index}`),
    ];
    const lambda = `+[](${lambdaParameters.join(', ')}) -> ${declaration.cppReturnTypeName} { return ${declaration.reference.code()}(${args.join(', ')}); }`;
    const name = declaration.tsFunctionName;

    return [
      `inline const ssc__core__struct__closure ssc__ts__closure__${name}{{0, __builtin_addressof(ssc__core__var__closure_descriptor)}, reinterpret_cast<void (*)()>(${lambda}), {0, nullptr}};`,
      `inline const ssc__core__type__ref ssc__ts__value__${name} = ssc__core__fn__function_value(ssc__ts__closure__${name});`,
    ];
  }
}

export class CppClassReference extends CppNode {
  readonly declaration: CppClassDeclaration;

  constructor(declaration: CppClassDeclaration) {
    super();
    this.declaration = declaration;
  }

  code() {
    return CppNode.toCppNamespacedName(this.declaration.pathId, this.declaration.cppClassName);
  }
}

// region core

export class CppCoreFunctionCall extends CppExpression {
  readonly cppFunctionName: CppCoreFunctionName | CppBuiltinFunctionName;
  readonly templateTypeNames: string[];
  readonly arguments: CppExpression[];

  constructor(
    cppFunctionName: CppCoreFunctionName | CppBuiltinFunctionName,
    templateTypeNames: string[],
    args: CppExpression[],
  ) {
    super();
    this.cppFunctionName = cppFunctionName;
    this.templateTypeNames = templateTypeNames;
    this.arguments = args;
  }

  code() {
    const templateArguments =
      this.templateTypeNames.length === 0 ?
        ''
      : `<${this.templateTypeNames.map((t) => CppNode.toCppTypeName(t)).join(', ')}>`;
    const args = this.arguments.map((a) => a.code()).join(', ');

    return `${this.cppFunctionName}${templateArguments}(${args})`;
  }
}

// region operator

export type CppBinaryOperator =
  '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '=' | ',';

export type CppUnaryOperator = '!' | '-' | '++' | '--';

export class CppBinaryExpression extends CppExpression {
  readonly operator: CppBinaryOperator;
  readonly left: CppExpression;
  readonly right: CppExpression;

  constructor(operator: CppBinaryOperator, left: CppExpression, right: CppExpression) {
    super();
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  code() {
    return `(${this.left.code()} ${this.operator} ${this.right.code()})`;
  }
}

export class CppUnaryExpression extends CppExpression {
  readonly operator: CppUnaryOperator;
  readonly operand: CppExpression;
  readonly isPostfix: boolean;

  constructor(operator: CppUnaryOperator, operand: CppExpression, isPostfix: boolean) {
    super();
    this.operator = operator;
    this.operand = operand;
    this.isPostfix = isPostfix;
  }

  code() {
    const operand = this.operand.code();

    return this.isPostfix ? `(${operand}${this.operator})` : `(${this.operator}${operand})`;
  }
}

export class CppConditionalExpression extends CppExpression {
  readonly condition: CppExpression;
  readonly whenTrue: CppExpression;
  readonly whenFalse: CppExpression;

  constructor(condition: CppExpression, whenTrue: CppExpression, whenFalse: CppExpression) {
    super();
    this.condition = condition;
    this.whenTrue = whenTrue;
    this.whenFalse = whenFalse;
  }

  code() {
    return `(${this.condition.code()} ? ${this.whenTrue.code()} : ${this.whenFalse.code()})`;
  }
}

export class CppStaticCast extends CppExpression {
  readonly tsTypeName: string;
  readonly cppTypeName: string;
  readonly expression: CppExpression;

  constructor(tsTypeName: string, expression: CppExpression) {
    super();
    this.tsTypeName = tsTypeName;
    this.cppTypeName = CppNode.toCppTypeName(this.tsTypeName);
    this.expression = expression;
  }

  code() {
    return `static_cast<${this.cppTypeName}>(${this.expression.code()})`;
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

export class CppTryStatement extends CppStatement {
  readonly tryStatements: CppStatement[];
  readonly catchStatements: CppStatement[];

  constructor(tryStatements: CppStatement[], catchStatements: CppStatement[]) {
    super();
    this.tryStatements = tryStatements;
    this.catchStatements = catchStatements;
  }

  code() {
    const w = new CppWriter();

    w.block('try', () => this.tryStatements.flatMap((s) => s.code().split('\n')));
    w.block(` catch (const ssc__core__type__union& ${CppTryStatement.exceptionName})`, () =>
      this.catchStatements.flatMap((s) => s.code().split('\n')),
    );

    return w.lines().join('\n');
  }

  static readonly exceptionName = 'ssc__core__var__exception';
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
