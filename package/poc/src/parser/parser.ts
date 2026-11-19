import {
  AbstractExpression,
  AbstractStatement,
  NodeAssignmentStatement,
  NodeBinaryExpression,
  NodeBlockExpression,
  NodeCallExpression,
  NodeExpressionStatement,
  NodeFunctionExpression,
  NodeIdentifier,
  NodeMemberExpression,
  NodeNumberLiteralExpression,
  NodeSourceFile,
  NodeVariableDeclarationStatement,
  NodeVariableReferenceExpression,
} from '~/parser/ast.js';
import { tokenize } from '~/parser/lexer.js';
import { Token } from '~/parser/token.js';

const additiveOperators: NodeBinaryExpression['operator'][] = ['+', '-'];
const multiplicativeOperators: NodeBinaryExpression['operator'][] = ['*', '/'];

export function parse(source: string) {
  const parser = new Parser(tokenize(source));

  return parser.parseSourceFile();
}

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseSourceFile() {
    const statements: AbstractStatement[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      this.skipExpressionEnds();

      if (!this.peek()) {
        break;
      }

      statements.push(this.parseStatement());

      const token = this.peek();

      if (token && token.kind !== 'expression-end') {
        throw new Error(`expected end of expression at ${token.span.start}`);
      }
    }

    const end = this.tokens.at(-1)?.span.end ?? 0;

    return new NodeSourceFile({ start: 0, end }, statements);
  }

  // Blank lines produce consecutive expression ends
  private skipExpressionEnds() {
    while (this.peek()?.kind === 'expression-end') {
      this.index++;
    }
  }

  private parseStatement() {
    const token = this.peek();

    if (!token) {
      throw new Error('unexpected end of file');
    }

    if (token.kind === 'keyword' && (token.text === 'val' || token.text === 'var')) {
      this.next();

      const identifier = this.parseIdentifier();

      this.expectOperator('=');

      const value = this.parseExpression();
      const span = { start: token.span.start, end: value.span.end };

      return new NodeVariableDeclarationStatement(span, token.text, identifier, value);
    }

    const expression = this.parseExpression();
    const nextToken = this.peek();

    if (nextToken?.kind === 'operator' && nextToken.text === '=') {
      if (!(expression instanceof NodeVariableReferenceExpression)) {
        throw new Error(`invalid assignment target at ${expression.span.start}`);
      }

      this.next();

      const value = this.parseExpression();
      const span = { start: expression.span.start, end: value.span.end };

      return new NodeAssignmentStatement(span, expression, value);
    }

    return new NodeExpressionStatement(expression.span, expression);
  }

  private parseExpression() {
    return this.parseAdditive();
  }

  private parseAdditive() {
    let left: AbstractExpression = this.parseMultiplicative();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const operator = this.findOperator(additiveOperators);

      if (!operator) {
        return left;
      }

      const right = this.parseMultiplicative();
      const span = { start: left.span.start, end: right.span.end };

      left = new NodeBinaryExpression(span, operator, left, right);
    }
  }

  private parseMultiplicative() {
    let left: AbstractExpression = this.parsePostfix();

    for (;;) {
      const operator = this.findOperator(multiplicativeOperators);

      if (!operator) {
        return left;
      }

      const right = this.parsePostfix();
      const span = { start: left.span.start, end: right.span.end };

      left = new NodeBinaryExpression(span, operator, left, right);
    }
  }

  private parsePostfix() {
    let expression: AbstractExpression = this.parsePrimary();

    for (;;) {
      const token = this.peek();

      if (token?.kind === 'operator' && token.text === '.') {
        this.next();

        const identifier = this.parseIdentifier();
        const span = { start: expression.span.start, end: identifier.span.end };

        expression = new NodeMemberExpression(span, expression, identifier);
        continue;
      }

      if (token?.kind === 'bracket' && token.text === '(') {
        this.next();

        const args: AbstractExpression[] = [];
        const closeToken = this.peek();

        if (!(closeToken?.kind === 'bracket' && closeToken.text === ')')) {
          args.push(this.parseExpression());
        }

        const endToken = this.expectBracket(')');
        const span = { start: expression.span.start, end: endToken.span.end };

        expression = new NodeCallExpression(span, expression, args);
        continue;
      }

      return expression;
    }
  }

  private parsePrimary() {
    const token = this.next();

    if (token.kind === 'number') {
      return new NodeNumberLiteralExpression(token.span, token.text);
    }

    if (token.kind === 'identifier') {
      return new NodeVariableReferenceExpression(new NodeIdentifier(token.span, token.text));
    }

    if (token.kind === 'keyword' && token.text === 'fn') {
      return this.parseFunction(token);
    }

    if (token.kind === 'bracket' && token.text === '{') {
      return this.parseBlock(token);
    }

    throw new Error(`unexpected token '${token.text}' at ${token.span.start}`);
  }

  private parseFunction(fnToken: Token) {
    this.expectBracket('(');
    this.expectBracket(')');

    const body = this.parseExpression();
    const span = { start: fnToken.span.start, end: body.span.end };

    return new NodeFunctionExpression(span, body);
  }

  private parseBlock(openToken: Token) {
    const statements: AbstractStatement[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      this.skipExpressionEnds();

      const token = this.peek();

      if (token?.kind === 'bracket' && token.text === '}') {
        break;
      }

      statements.push(this.parseStatement());

      const nextToken = this.peek();
      const isEnd =
        nextToken?.kind === 'expression-end'
        || (nextToken?.kind === 'bracket' && nextToken.text === '}');

      if (nextToken && !isEnd) {
        throw new Error(`expected end of expression at ${nextToken.span.start}`);
      }
    }

    const closeToken = this.expectBracket('}');
    const span = { start: openToken.span.start, end: closeToken.span.end };

    return new NodeBlockExpression(span, statements);
  }

  private parseIdentifier() {
    const token = this.next();

    if (token.kind !== 'identifier') {
      throw new Error(`expected identifier at ${token.span.start}`);
    }

    return new NodeIdentifier(token.span, token.text);
  }

  private findOperator(operators: NodeBinaryExpression['operator'][]) {
    const token = this.peek();

    if (token?.kind !== 'operator') {
      return undefined;
    }

    const operator = operators.find((operator) => operator === token.text);

    if (operator) {
      this.next();
    }

    return operator;
  }

  private expectOperator(text: string) {
    const token = this.next();

    if (!(token.kind === 'operator' && token.text === text)) {
      throw new Error(`expected '${text}' at ${token.span.start}`);
    }

    return token;
  }

  private expectBracket(text: string) {
    const token = this.next();

    if (!(token.kind === 'bracket' && token.text === text)) {
      throw new Error(`expected '${text}' at ${token.span.start}`);
    }

    return token;
  }

  private peek() {
    return this.tokens[this.index];
  }

  private next() {
    const token = this.peek();

    if (!token) {
      throw new Error('unexpected end of file');
    }

    this.index++;

    return token;
  }
}
