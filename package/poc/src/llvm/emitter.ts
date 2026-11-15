import { assertNever } from '@syscript/share/util';
import {
  LlvmArrayType,
  LlvmFunction,
  LlvmModule,
  LlvmNumberLiteral,
  LlvmReturnStatement,
  LlvmStatement,
  LlvmStructType,
  LlvmType,
  LlvmUnknownStatement,
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
  //   AbstractExpression,
  AbstractStatement,
  //   NodeAssignmentStatement,
  //   NodeBinaryExpression,
  //   NodeCallExpression,
  //   NodeExpressionStatement,
  //   NodeMemberExpression,
  //   NodeNumberLiteralExpression,
  NodeSourceFile,
} from '~/parser/ast.js';

// const binaryInstructions = {
//   '+': 'add',
//   '-': 'sub',
//   '*': 'mul',
//   '/': 'sdiv',
// } as const satisfies Record<NodeBinaryExpression['operator'], string>;

export function emitLlvmIr(sourceFile: NodeSourceFile) {
  const emitter = new LlvmIrEmitter();
  const module = new LlvmModule();
  const mainFn = LlvmFunction.main();

  module.functions.push(mainFn);

  for (const statement of sourceFile.statements) {
    emitter.lowerStatement(statement);
  }

  mainFn
    .getEntryBlock()
    .statements.push(new LlvmReturnStatement(new LlvmNumberLiteral('i32', '0')));

  return emitter.moduleIr(module);
}

class LlvmIrEmitter {
  lowerStatement(statement: AbstractStatement) {
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
    const parameters = fn.parameters.map((p, idx) => `${this.typeIr(p.type)} %${idx}`);
    const lines: string[] = [];

    lines.push(`define ${fn.returnType} @${fn.id}(${parameters.join(', ')}) {`);

    for (const [index, block] of fn.blocks.entries()) {
      lines.push(`block.${index}:`);

      for (const statement of block.statements) {
        lines.push(`  ${this.statementIr(statement)}`);
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

  private statementIr(statement: LlvmStatement) {
    if (statement instanceof LlvmReturnStatement) {
      if (!statement.value) {
        return 'ret void';
      }

      return `ret ${this.valueIr(statement.value)}`;
    }

    if (statement instanceof LlvmUnknownStatement) {
      return statement.text;
    }

    assertNever(statement);
  }

  private valueIr(value: LlvmNumberLiteral) {
    return `${value.type} ${value.value}`;
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
