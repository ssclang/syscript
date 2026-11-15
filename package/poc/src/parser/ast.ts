import { VariableDeclarationKeyword } from '~/parser/token.js';

export type SourceFileSpan = {
  start: number;
  end: number;
};

export abstract class AbstractNode {
  readonly span: SourceFileSpan;

  constructor(span: SourceFileSpan) {
    this.span = span;
  }
}

export abstract class AbstractStatement extends AbstractNode {}

export abstract class AbstractExpression extends AbstractNode {}

export class NodeSourceFile extends AbstractNode {
  readonly statements: AbstractStatement[];

  constructor(span: SourceFileSpan, statements: AbstractStatement[]) {
    super(span);
    this.statements = statements;
  }
}

export class NodeIdentifier extends AbstractNode {
  readonly name: string;

  constructor(span: SourceFileSpan, name: string) {
    super(span);
    this.name = name;
  }
}

export class NodeVariableDeclarationStatement extends AbstractStatement {
  readonly keyword: VariableDeclarationKeyword;
  readonly reference: NodeVariableReferenceExpression;
  readonly value: AbstractExpression;

  constructor(
    span: SourceFileSpan,
    keyword: VariableDeclarationKeyword,
    identifier: NodeIdentifier,
    value: AbstractExpression,
  ) {
    super(span);
    this.keyword = keyword;
    this.reference = new NodeVariableReferenceExpression(identifier);
    this.value = value;
  }
}

export class NodeAssignmentStatement extends AbstractStatement {
  readonly reference: NodeVariableReferenceExpression;
  readonly value: AbstractExpression;

  constructor(
    span: SourceFileSpan,
    reference: NodeVariableReferenceExpression,
    value: AbstractExpression,
  ) {
    super(span);
    this.reference = reference;
    this.value = value;
  }
}

export class NodeExpressionStatement extends AbstractStatement {
  readonly expression: AbstractExpression;

  constructor(span: SourceFileSpan, expression: AbstractExpression) {
    super(span);
    this.expression = expression;
  }
}

export class NodeVariableReferenceExpression extends AbstractExpression {
  readonly identifier: NodeIdentifier;

  constructor(identifier: NodeIdentifier) {
    super(identifier.span);
    this.identifier = identifier;
  }
}

export class NodeNumberLiteralExpression extends AbstractExpression {
  readonly value: string;

  constructor(span: SourceFileSpan, value: string) {
    super(span);
    this.value = value;
  }
}

export class NodeBinaryExpression extends AbstractExpression {
  readonly operator: '+' | '-' | '*' | '/';
  readonly left: AbstractExpression;
  readonly right: AbstractExpression;

  constructor(
    span: SourceFileSpan,
    operator: '+' | '-' | '*' | '/',
    left: AbstractExpression,
    right: AbstractExpression,
  ) {
    super(span);
    this.operator = operator;
    this.left = left;
    this.right = right;
  }
}

export class NodeCallExpression extends AbstractExpression {
  readonly callee: AbstractExpression;
  readonly arguments: AbstractExpression[];

  constructor(span: SourceFileSpan, callee: AbstractExpression, args: AbstractExpression[]) {
    super(span);
    this.callee = callee;
    this.arguments = args;
  }
}

export class NodeMemberExpression extends AbstractExpression {
  readonly object: AbstractExpression;
  readonly identifier: NodeIdentifier;

  constructor(span: SourceFileSpan, object: AbstractExpression, identifier: NodeIdentifier) {
    super(span);
    this.object = object;
    this.identifier = identifier;
  }
}
