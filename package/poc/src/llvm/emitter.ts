import { assertNever } from '@syscript/share/util';
import {
  LlvmAllocaStatement,
  LlvmArrayType,
  LlvmBlock,
  LlvmCallStatement,
  LlvmFunction,
  LlvmLoadStatement,
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
  NodeVariableReferenceExpression,
} from '~/parser/ast.js';

type LocalIdMap = Map<LlvmValue, number>;

type DeclarationSymbol = LlvmAllocaStatement | LlvmFunction;

class Scope {
  readonly parent: Scope | undefined;
  private readonly declarationSymbolMap: Map<string, DeclarationSymbol>;

  private constructor(parent: Scope | undefined) {
    this.parent = parent;
    this.declarationSymbolMap = new Map();
  }

  static moduleRoot() {
    return new Scope(undefined);
  }

  createChild() {
    return new Scope(this);
  }

  addDeclaration(name: string, symbol: DeclarationSymbol) {
    this.declarationSymbolMap.set(name, symbol);
  }

  findDeclaration(name: string): DeclarationSymbol | undefined {
    return this.declarationSymbolMap.get(name) || this.parent?.findDeclaration(name);
  }

  hasDeclarationInCurrentScope(name: string) {
    return this.declarationSymbolMap.has(name);
  }
}

// const binaryInstructions = {
//   '+': 'add',
//   '-': 'sub',
//   '*': 'mul',
//   '/': 'sdiv',
// } as const satisfies Record<NodeBinaryExpression['operator'], string>;

export function emitLlvmIr(sourceFile: NodeSourceFile) {
  const emitter = new LlvmIrEmitter();
  const module = new LlvmModule();
  const moduleScope = emitter.prepareModuleScope(sourceFile);
  const userMainFn = moduleScope.findDeclaration('main');

  if (!(userMainFn instanceof LlvmFunction)) {
    throw new Error('entry file must declare main function');
  }

  const mainFn = new LlvmFunction('main', 'i32', []);

  mainFn
    .getEntryBlock()
    .statements.push(
      new LlvmCallStatement(userMainFn.returnType, userMainFn.id),
      new LlvmReturnStatement(new LlvmNumberLiteral('i32', '0')),
    );

  const userFunctions = emitter.lowerSourceFile(moduleScope, sourceFile);

  module.functions.push(...userFunctions);
  module.functions.push(mainFn);

  return emitter.moduleIr(module);
}

class LlvmIrEmitter {
  // ssc:<module path>:<name>
  private static functionId(modulePath: string, name: string) {
    return `ssc:${modulePath}:${name}`;
  }

  prepareModuleScope(sourceFile: NodeSourceFile) {
    const moduleScope = Scope.moduleRoot();

    for (const statement of sourceFile.statements) {
      if (!(statement instanceof NodeVariableDeclarationStatement)) {
        throw new Error('top-level statement must be a declaration');
      }

      if (!(statement.value instanceof NodeFunctionExpression)) {
        throw new Error('not implemented top-level non-function declaration');
      }

      const name = statement.reference.identifier.name;

      if (moduleScope.hasDeclarationInCurrentScope(name)) {
        throw new Error(`'${name}' is already declared at ${statement.span.start}`);
      }

      moduleScope.addDeclaration(
        name,
        new LlvmFunction(LlvmIrEmitter.functionId('main.ss', name), 'void', []),
      );
    }

    return moduleScope;
  }

  lowerSourceFile(moduleScope: Scope, sourceFile: NodeSourceFile) {
    const functions: LlvmFunction[] = [];

    for (const statement of sourceFile.statements) {
      if (!(statement instanceof NodeVariableDeclarationStatement)) {
        throw new Error('top-level statement must be a declaration');
      }

      if (!(statement.value instanceof NodeFunctionExpression)) {
        throw new Error('not implemented top-level non-function declaration');
      }

      const fn = moduleScope.findDeclaration(statement.reference.identifier.name);

      if (!(fn instanceof LlvmFunction)) {
        throw new Error(`'${statement.reference.identifier.name}' is not declared as a function`);
      }

      functions.push(this.lowerFunction(moduleScope, fn, statement.value));
    }

    return functions;
  }

  private lowerFunction(moduleScope: Scope, fn: LlvmFunction, node: NodeFunctionExpression) {
    const entryBlock = fn.getEntryBlock();

    this.lowerExpression(moduleScope.createChild(), fn, entryBlock, node.body);
    entryBlock.statements.push(new LlvmReturnStatement());

    return fn;
  }

  private lowerExpression(
    currentScope: Scope,
    currentFunction: LlvmFunction,
    currentBlock: LlvmBlock,
    expression: AbstractExpression,
  ): LlvmValue | undefined {
    if (expression instanceof NodeNumberLiteralExpression) {
      // Every number is i64 until types are checked
      return new LlvmNumberLiteral('i64', expression.value);
    }

    if (expression instanceof NodeVariableReferenceExpression) {
      const name = expression.identifier.name;
      const declaration = currentScope.findDeclaration(name);

      if (!declaration) {
        throw new Error(`'${name}' is not declared`);
      }

      if (declaration instanceof LlvmFunction) {
        throw new Error('not implemented function value');
      }

      const load = new LlvmLoadStatement(declaration.type, declaration.address);

      currentBlock.statements.push(load);

      return load.value;
    }

    if (expression instanceof NodeBlockExpression) {
      const blockScope = currentScope.createChild();

      for (const statement of expression.statements) {
        this.lowerStatement(blockScope, currentFunction, currentBlock, statement);
      }

      return undefined;
    }

    throw new Error(`not implemented expression ${expression.constructor.name}`);
  }

  private lowerStatement(
    currentScope: Scope,
    currentFunction: LlvmFunction,
    currentBlock: LlvmBlock,
    statement: AbstractStatement,
  ) {
    if (statement instanceof NodeVariableDeclarationStatement) {
      const name = statement.reference.identifier.name;
      // Lowered before binding the name so that a shadowing declaration can read the previous one
      const value = this.lowerExpression(
        currentScope,
        currentFunction,
        currentBlock,
        statement.value,
      );

      if (!value) {
        throw new Error(`expression has no value at ${statement.value.span.start}`);
      }

      const alloca = new LlvmAllocaStatement('i64');

      currentScope.addDeclaration(name, alloca);
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

      for (const statement of block.statements) {
        if (statement instanceof LlvmLoadStatement) {
          localIdMap.set(statement.value, order);
          order++;
        }
      }
    }

    lines.push(`define ${fn.returnType} @"${fn.id}"(${parameterIrs.join(', ')}) {`);

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
      return `${this.localIdIr(statement.address, localIdMap)} = alloca ${this.typeIr(statement.type)}`;
    }

    if (statement instanceof LlvmStoreStatement) {
      const value = this.valueIr(statement.value, localIdMap);
      const address = this.valueIr(statement.address, localIdMap);

      return `store ${value}, ${address}`;
    }

    if (statement instanceof LlvmLoadStatement) {
      const value = this.localIdIr(statement.value, localIdMap);
      const address = this.valueIr(statement.address, localIdMap);

      return `${value} = load ${this.typeIr(statement.value.type)}, ${address}`;
    }

    if (statement instanceof LlvmReturnStatement) {
      if (!statement.value) {
        return 'ret void';
      }

      return `ret ${this.valueIr(statement.value, localIdMap)}`;
    }

    if (statement instanceof LlvmCallStatement) {
      return `call ${statement.returnType} @"${statement.calleeId}"()`;
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

    return `${type} ${this.localIdIr(value, localIdMap)}`;
  }

  private localIdIr(value: LlvmValue, localIdMap: LocalIdMap) {
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
