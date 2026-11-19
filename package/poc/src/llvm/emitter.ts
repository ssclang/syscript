import { assertNever } from '@syscript/share/util';
import {
  LlvmAddress,
  LlvmAllocaStatement,
  LlvmArrayType,
  LlvmBlock,
  LlvmCallStatement,
  LlvmFunction,
  LlvmModule,
  LlvmNumberLiteral,
  LlvmReturnStatement,
  LlvmStatement,
  LlvmStoreStatement,
  LlvmStructType,
  LlvmType,
  LlvmUnknownStatement,
  LlvmValue,
} from '~/llvm/ir.js';
// import { assertNever } from '@syscript/share/util';
// import {
//   LlvmArrayType,
//   LlvmDeclareFunction,
//   LlvmFunction,
//   LlvmModule,
//   LlvmNumberLiteral,
//   LlvmReturnStatement,
//   LlvmStatement,
//   LlvmStructType,
//   LlvmType,
//   LlvmUnknownStatement,
// } from '~/llvm/ir.js';
import {
  AbstractExpression,
  AbstractStatement,
  //   NodeAssignmentStatement,
  //   NodeBinaryExpression,
  NodeBlockExpression,
  //   NodeCallExpression,
  //   NodeExpressionStatement,
  NodeFunctionExpression,
  //   NodeMemberExpression,
  NodeNumberLiteralExpression,
  NodeSourceFile,
  NodeVariableDeclarationStatement,
} from '~/parser/ast.js';

type LocalIdMap = Map<LlvmAddress, number>;

// const binaryInstructions = {
//   '+': 'add',
//   '-': 'sub',
//   '*': 'mul',
//   '/': 'sdiv',
// } as const satisfies Record<NodeBinaryExpression['operator'], string>;

export function emitLlvmIr(sourceFile: NodeSourceFile) {
  const emitter = new LlvmIrEmitter();
  const module = new LlvmModule();
  const userMainFn = emitter.lowerUserMain(sourceFile);
  const mainFn = new LlvmFunction('main', 'i32', []);

  mainFn
    .getEntryBlock()
    .statements.push(
      new LlvmCallStatement('void', userMainFn.id),
      new LlvmReturnStatement(new LlvmNumberLiteral('i32', '0')),
    );

  module.functions.push(userMainFn, mainFn);

  return emitter.moduleIr(module);
}

class LlvmIrEmitter {
  // ssc.<module path>.<name>
  private static functionId(modulePath: string, name: string) {
    return `ssc.${modulePath}.${name}`;
  }

  lowerUserMain(sourceFile: NodeSourceFile) {
    let mainDeclaration: NodeVariableDeclarationStatement | undefined;

    for (const statement of sourceFile.statements) {
      if (
        statement instanceof NodeVariableDeclarationStatement
        && statement.reference.identifier.name === 'main'
      ) {
        mainDeclaration = statement;
        continue;
      }

      throw new Error(`not implemented statement ${statement.constructor.name}`);
    }

    if (!mainDeclaration) {
      throw new Error('entry file must declare main');
    }

    if (!(mainDeclaration.value instanceof NodeFunctionExpression)) {
      throw new Error('main must be a function');
    }

    // Module path is the entry-relative path without extension, fixed to 'main' until multiple files are supported
    return this.lowerFunction(LlvmIrEmitter.functionId('main', 'main'), mainDeclaration.value);
  }

  private lowerFunction(id: string, node: NodeFunctionExpression) {
    const fn = new LlvmFunction(id, 'void', []);
    const entryBlock = fn.getEntryBlock();

    this.lowerExpression(fn, entryBlock, node.body);
    entryBlock.statements.push(new LlvmReturnStatement());

    return fn;
  }

  private lowerExpression(
    currentFunction: LlvmFunction,
    currentBlock: LlvmBlock,
    expression: AbstractExpression,
  ): LlvmValue | undefined {
    if (expression instanceof NodeNumberLiteralExpression) {
      // Every number is i64 until types are checked
      return new LlvmNumberLiteral('i64', expression.value);
    }

    if (expression instanceof NodeBlockExpression) {
      for (const statement of expression.statements) {
        this.lowerStatement(currentFunction, currentBlock, statement);
      }

      return undefined;
    }

    throw new Error(`not implemented expression ${expression.constructor.name}`);
  }

  private lowerStatement(
    currentFunction: LlvmFunction,
    currentBlock: LlvmBlock,
    statement: AbstractStatement,
  ) {
    if (statement instanceof NodeVariableDeclarationStatement) {
      const value = this.lowerExpression(currentFunction, currentBlock, statement.value);

      if (!value) {
        throw new Error(`expression has no value at ${statement.value.span.start}`);
      }

      const alloca = new LlvmAllocaStatement('i64');

      currentFunction.getEntryBlock().allocas.push(alloca);
      currentBlock.statements.push(new LlvmStoreStatement(value, alloca.address));
      return;
    }

    throw new Error(`not implemented statement ${statement.constructor.name}`);
  }

  moduleIr(module: LlvmModule) {
    const functions = module.functions.map((f) => this.functionIr(f));
    const lines: string[] = [];

    for (const f of functions) {
      lines.push(f);
    }

    return lines.join('\n');
  }

  private functionIr(fn: LlvmFunction) {
    const parameterIrs: string[] = [];
    const localIdMap: LocalIdMap = new Map();
    const lines: string[] = [];
    let order = 0;

    for (const parameter of fn.parameters) {
      parameterIrs.push(`${this.typeIr(parameter.type)} %${order}`);
      order++;
    }

    for (const block of fn.blocks) {
      for (const alloca of block.allocas) {
        localIdMap.set(alloca.address, order);
        order++;
      }
    }

    lines.push(`define ${fn.returnType} @${fn.id}(${parameterIrs.join(', ')}) {`);

    for (const [index, block] of fn.blocks.entries()) {
      lines.push(`block.${index}:`);

      for (const alloca of block.allocas) {
        lines.push(`  ${this.statementIr(alloca, localIdMap)}`);
      }

      for (const statement of block.statements) {
        lines.push(`  ${this.statementIr(statement, localIdMap)}`);
      }
    }

    lines.push('}', '');

    return lines.join('\n');
  }

  private typeIr(type: LlvmType): string {
    if (typeof type === 'string') {
      return type;
    }

    if (type instanceof LlvmArrayType) {
      return `[${type.length} x ${this.typeIr(type.elementType)}]`;
    }

    if (type instanceof LlvmStructType) {
      if (type.id) {
        return `%${type.id}`;
      }

      return `{ ${type.elementTypes.map((t) => this.typeIr(t)).join(', ')} }`;
    }

    assertNever(type);
  }

  private statementIr(statement: LlvmStatement, localIdMap: LocalIdMap) {
    if (statement instanceof LlvmAllocaStatement) {
      return `${this.localIr(statement.address, localIdMap)} = alloca ${this.typeIr(statement.type)}`;
    }

    if (statement instanceof LlvmStoreStatement) {
      const value = this.valueIr(statement.value, localIdMap);
      const address = this.valueIr(statement.address, localIdMap);

      return `store ${value}, ${address}`;
    }

    if (statement instanceof LlvmReturnStatement) {
      if (!statement.value) {
        return 'ret void';
      }

      return `ret ${this.valueIr(statement.value, localIdMap)}`;
    }

    if (statement instanceof LlvmCallStatement) {
      return `call ${statement.returnType} @${statement.calleeId}()`;
    }

    if (statement instanceof LlvmUnknownStatement) {
      return statement.text;
    }

    assertNever(statement);
  }

  private valueIr(value: LlvmValue, localIdMap: LocalIdMap) {
    const type = this.typeIr(value.type);

    if (value instanceof LlvmNumberLiteral) {
      return `${type} ${value.value}`;
    }

    if (value instanceof LlvmAddress) {
      return `${type} ${this.localIr(value, localIdMap)}`;
    }

    throw new Error(`not implemented value ${value.constructor.name}`);
  }

  private localIr(value: LlvmAddress, localIdMap: LocalIdMap) {
    const id = localIdMap.get(value);

    if (id === undefined) {
      throw new Error('local is not numbered');
    }

    return `%${id}`;
  }
}

// class LlvmIrEmitter {
//   readonly lines: string[] = [];
//   private readonly variableAddresses = new Map<string, string>();
//   private temporaryCount = 0;

//   moduleIr(module: LlvmModule) {
//     const declareFunctionLines = module.declareFunctions.map((declareFunction) =>
//       this.declareFunctionIr(declareFunction),
//     );
//     const functionCodes = module.functions.map((llvmFunction) => this.functionIr(llvmFunction));

//     return [...declareFunctionLines, '', ...functionCodes].join('\n');
//   }

//   private declareFunctionIr(declareFunction: LlvmDeclareFunction) {
//     const parameters = declareFunction.parameters.map((parameter) => this.typeIr(parameter.type));

//     return `declare ${declareFunction.returnType} @${declareFunction.id}(${parameters.join(', ')})`;
//   }

//   private typeIr(type: LlvmType): string {
//     if (typeof type === 'string') {
//       return type;
//     }

//     if (type instanceof LlvmArrayType) {
//       return `[${type.length} x ${this.typeIr(type.elementType)}]`;
//     }

//     if (type instanceof LlvmStructType) {
//       if (type.id) {
//         return `%${type.id}`;
//       }

//       return `{ ${type.elementTypes.map((elementType) => this.typeIr(elementType)).join(', ')} }`;
//     }

//     assertNever(type);
//   }

//   private functionIr(llvmFunction: LlvmFunction) {
//     const parameters = llvmFunction.parameters.map(
//       (parameter, index) => `${this.typeIr(parameter.type)} %${index}`,
//     );
//     const lines = [
//       `define ${llvmFunction.returnType} @${llvmFunction.id}(${parameters.join(', ')}) {`,
//     ];

//     for (const [index, block] of llvmFunction.blocks.entries()) {
//       lines.push(`block.${index}:`);

//       for (const statement of block.statements) {
//         lines.push(`  ${this.statementIr(statement)}`);
//       }
//     }

//     lines.push('}', '');

//     return lines.join('\n');
//   }

//   private statementIr(statement: LlvmStatement) {
//     if (statement instanceof LlvmReturnStatement) {
//       if (!statement.value) {
//         return 'ret void';
//       }

//       return `ret ${this.valueIr(statement.value)}`;
//     }

//     if (statement instanceof LlvmUnknownStatement) {
//       return statement.text;
//     }

//     assertNever(statement);
//   }

//   private valueIr(value: LlvmNumberLiteral) {
//     return `${value.type} ${value.value}`;
//   }

//   emitStatement(statement: AbstractStatement) {
//     if (statement instanceof NodeVariableDeclarationStatement) {
//       const name = statement.reference.identifier.name;
//       const address = `%${name}.address`;
//       const value = this.emitExpression(statement.value);

//       this.variableAddresses.set(name, address);
//       this.lines.push(`${address} = alloca i64`);
//       this.lines.push(`store i64 ${value}, ptr ${address}`);
//       return;
//     }

//     if (statement instanceof NodeAssignmentStatement) {
//       const address = this.getVariableAddress(statement.reference);
//       const value = this.emitExpression(statement.value);

//       this.lines.push(`store i64 ${value}, ptr ${address}`);
//       return;
//     }

//     if (statement instanceof NodeExpressionStatement) {
//       this.emitExpression(statement.expression);
//       return;
//     }

//     throw new Error(`not implemented statement ${statement.constructor.name}`);
//   }

//   private emitExpression(expression: AbstractExpression): string {
//     if (expression instanceof NodeNumberLiteralExpression) {
//       return expression.value;
//     }

//     if (expression instanceof NodeVariableReferenceExpression) {
//       const address = this.getVariableAddress(expression);
//       const temporary = this.createTemporary();

//       this.lines.push(`${temporary} = load i64, ptr ${address}`);

//       return temporary;
//     }

//     if (expression instanceof NodeBinaryExpression) {
//       const left = this.emitExpression(expression.left);
//       const right = this.emitExpression(expression.right);
//       const temporary = this.createTemporary();

//       this.lines.push(
//         `${temporary} = ${binaryInstructions[expression.operator]} i64 ${left}, ${right}`,
//       );

//       return temporary;
//     }

//     if (expression instanceof NodeCallExpression) {
//       const callee = expression.callee;

//       if (
//         callee instanceof NodeMemberExpression
//         && callee.object instanceof NodeVariableReferenceExpression
//         && callee.object.identifier.name === 'std'
//         && callee.identifier.name === 'out'
//       ) {
//         const [argument] = expression.arguments;

//         if (!argument || expression.arguments.length !== 1) {
//           throw new Error('std.out expects one argument');
//         }

//         const value = this.emitExpression(argument);
//         const temporary = this.createTemporary();

//         this.lines.push(
//           `${temporary} = call i32 (ptr, ...) @printf(ptr @.i64.format, i64 ${value})`,
//         );

//         return temporary;
//       }

//       throw new Error('not implemented call');
//     }

//     throw new Error(`not implemented expression ${expression.constructor.name}`);
//   }

//   private getVariableAddress(reference: NodeVariableReferenceExpression) {
//     const address = this.variableAddresses.get(reference.identifier.name);

//     if (!address) {
//       throw new Error(`undefined variable ${reference.identifier.name}`);
//     }

//     return address;
//   }

//   private createTemporary() {
//     return `%t${this.temporaryCount++}`;
//   }
// }
