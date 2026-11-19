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
  readonly allocas: LlvmAllocaStatement[] = [];
  readonly statements: LlvmStatement[] = [];
}

export type LlvmStatement =
  | LlvmAllocaStatement
  | LlvmStoreStatement
  | LlvmReturnStatement
  | LlvmCallStatement
  | LlvmUnknownStatement;

export abstract class LlvmValue {
  readonly type: LlvmType;

  constructor(type: LlvmType) {
    this.type = type;
  }
}

export class LlvmAddress extends LlvmValue {
  constructor() {
    super('ptr');
  }
}

export class LlvmNumberLiteral extends LlvmValue {
  readonly value: string;

  constructor(type: LlvmPrimitiveType, value: string) {
    super(type);
    this.value = value;
  }
}

export class LlvmAllocaStatement {
  readonly type: LlvmType;
  readonly address: LlvmAddress;

  constructor(type: LlvmType) {
    this.type = type;
    this.address = new LlvmAddress();
  }
}

export class LlvmStoreStatement {
  readonly value: LlvmValue;
  readonly address: LlvmAddress;

  constructor(value: LlvmValue, address: LlvmAddress) {
    this.value = value;
    this.address = address;
  }
}

export class LlvmReturnStatement {
  readonly value?: LlvmNumberLiteral;

  constructor(value?: LlvmNumberLiteral) {
    this.value = value;
  }
}

export class LlvmCallStatement {
  readonly returnType: LlvmPrimitiveType;
  readonly calleeId: string;

  constructor(returnType: LlvmPrimitiveType, calleeId: string) {
    this.returnType = returnType;
    this.calleeId = calleeId;
  }
}

export class LlvmUnknownStatement {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
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
