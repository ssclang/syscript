import { assert } from '@syscript/share/util';

export class LlvmModule {
  readonly declareFunctions: LlvmDeclareFunction[] = [];
  readonly functions: LlvmFunction[] = [];
}

export class LlvmDeclareFunction {
  readonly id: string;
  readonly returnType: LlvmPrimitiveType;
  readonly parameters: LlvmParameter[];

  constructor(id: string, returnType: LlvmPrimitiveType, parameters: LlvmParameter[]) {
    this.id = id;
    this.returnType = returnType;
    this.parameters = parameters;
  }
}

export class LlvmFunction {
  readonly id: string;
  readonly returnType: LlvmPrimitiveType;
  readonly parameters: LlvmParameter[];
  readonly blocks: LlvmBlock[];

  constructor(id: string, returnType: LlvmPrimitiveType, parameters: LlvmParameter[]) {
    this.id = id;
    this.returnType = returnType;
    this.parameters = parameters;
    this.blocks = [new LlvmBlock()];
  }

  static main() {
    return new LlvmFunction('main', 'i32', []);
  }

  getBlock(index: number) {
    const block = this.blocks[index];

    assert(block);

    return block;
  }

  getEntryBlock() {
    return this.getBlock(0);
  }
}

export class LlvmParameter {
  readonly type: LlvmType;

  constructor(type: LlvmType) {
    this.type = type;
  }
}

export class LlvmBlock {
  readonly statements: LlvmStatement[] = [];
}

export type LlvmStatement = LlvmReturnStatement | LlvmUnknownStatement;

export class LlvmReturnStatement {
  readonly value?: LlvmNumberLiteral;

  constructor(value?: LlvmNumberLiteral) {
    this.value = value;
  }
}

export class LlvmUnknownStatement {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

export class LlvmNumberLiteral {
  readonly type: LlvmPrimitiveType;
  readonly value: string;

  constructor(type: LlvmPrimitiveType, value: string) {
    this.type = type;
    this.value = value;
  }
}

export type LlvmType = LlvmPrimitiveType | LlvmAggregateType;

export type LlvmPrimitiveType = 'void' | 'i1' | 'i8' | 'i32' | 'i64' | 'double' | 'ptr';

export type LlvmAggregateType = LlvmArrayType | LlvmStructType;

export class LlvmArrayType {
  readonly elementType: LlvmType;
  readonly length: number;

  constructor(elementType: LlvmType, length: number) {
    this.elementType = elementType;
    this.length = length;
  }
}

export class LlvmStructType {
  readonly id?: string;
  readonly elementTypes: LlvmType[];

  constructor(elementTypes: LlvmType[], id?: string) {
    this.elementTypes = elementTypes;
    this.id = id;
  }
}
