import { Bracket, brackets, operators, reservedKeywords, Token } from '~/parser/token.js';

const asciiCodeMap = {
  A: 'A'.charCodeAt(0),
  Z: 'Z'.charCodeAt(0),
  a: 'a'.charCodeAt(0),
  z: 'z'.charCodeAt(0),
  '0': '0'.charCodeAt(0),
  '9': '9'.charCodeAt(0),
  _: '_'.charCodeAt(0),

  f: 'f'.charCodeAt(0),
  F: 'F'.charCodeAt(0),
  n: 'n'.charCodeAt(0),
  t: 't'.charCodeAt(0),
  r: 'r'.charCodeAt(0),
  u: 'u'.charCodeAt(0),
  "'": "'".charCodeAt(0),
  '\\': '\\'.charCodeAt(0),
  $: '$'.charCodeAt(0),

  ' ': ' '.charCodeAt(0),
  '\t': '\t'.charCodeAt(0),
  '\r': '\r'.charCodeAt(0),
  '{': '{'.charCodeAt(0),
  '}': '}'.charCodeAt(0),
  '(': '('.charCodeAt(0),
  ')': ')'.charCodeAt(0),
  '[': '['.charCodeAt(0),
  ']': ']'.charCodeAt(0),
  ',': ','.charCodeAt(0),
  '.': '.'.charCodeAt(0),

  '=': '='.charCodeAt(0),
  '+': '+'.charCodeAt(0),
  '-': '-'.charCodeAt(0),
  '*': '*'.charCodeAt(0),
  '/': '/'.charCodeAt(0),
} as const;

const bracketPairMap = {
  '(': { pair: ')', currentKind: 'open', pairKind: 'close' },
  ')': { pair: '(', currentKind: 'close', pairKind: 'open' },
  '{': { pair: '}', currentKind: 'open', pairKind: 'close' },
  '}': { pair: '{', currentKind: 'close', pairKind: 'open' },
  '[': { pair: ']', currentKind: 'open', pairKind: 'close' },
  ']': { pair: '[', currentKind: 'close', pairKind: 'open' },
} as const satisfies Record<
  Bracket,
  { pair: Bracket; currentKind: 'open' | 'close'; pairKind: 'open' | 'close' }
>;

const escapeMap = new Map([
  [asciiCodeMap['\\'], '\\'],
  [asciiCodeMap["'"], "'"],
  [asciiCodeMap.$, '$'],
  [asciiCodeMap.n, '\n'],
  [asciiCodeMap.t, '\t'],
  [asciiCodeMap.r, '\r'],
  [asciiCodeMap['0'], '\0'],
]);

export function tokenize(source: string) {
  const tokenizer = new Tokenizer(source);
  const tokens: Token[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const token = tokenizer.nextToken();

    if (!token) {
      break;
    }

    tokens.push(token);
  }

  return tokens;
}

class Tokenizer {
  private static readonly textEncoder = new TextEncoder();
  private static readonly textDecoder = new TextDecoder();

  private readonly bytes: Uint8Array;
  private readonly bracketStack: Bracket[] = [];
  private index = 0;

  constructor(source: string) {
    this.bytes = Tokenizer.textEncoder.encode(source);
  }

  private static isInlineWhitespace(byte: number) {
    if (byte === asciiCodeMap[' ']) {
      return true;
    }

    if (byte === asciiCodeMap['\t']) {
      return true;
    }

    if (byte === asciiCodeMap['\r']) {
      return true;
    }

    return false;
  }

  private static isDigit(byte: number) {
    return asciiCodeMap['0'] <= byte && byte <= asciiCodeMap['9'];
  }

  private static isHexDigit(byte: number) {
    if (Tokenizer.isDigit(byte)) {
      return true;
    }

    if (asciiCodeMap.a <= byte && byte <= asciiCodeMap.f) {
      return true;
    }

    if (asciiCodeMap.A <= byte && byte <= asciiCodeMap.F) {
      return true;
    }

    return false;
  }

  private static isIdentifierLetter(byte: number) {
    if (Tokenizer.isDigit(byte)) {
      return true;
    }

    if (byte === asciiCodeMap._) {
      return true;
    }

    if (asciiCodeMap.A <= byte && byte <= asciiCodeMap.Z) {
      return true;
    }

    if (asciiCodeMap.a <= byte && byte <= asciiCodeMap.z) {
      return true;
    }

    return false;
  }

  private static isStringQuote(byte: number) {
    return byte === asciiCodeMap["'"];
  }

  private static isOperator(byte: number) {
    return operators.some((o) => asciiCodeMap[o] === byte);
  }

  private static isBracket(byte: number) {
    return brackets.some((b) => asciiCodeMap[b] === byte);
  }

  private static isComma(byte: number) {
    return byte === asciiCodeMap[','];
  }

  private peek() {
    return this.bytes[this.index];
  }

  private readWhile(continueFn: (byte: number) => boolean) {
    const start = this.index;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const byte = this.peek();

      if (byte === undefined || !continueFn(byte)) {
        break;
      }

      this.index++;
    }

    const end = this.index;

    return {
      span: { start, end },
      text: Tokenizer.textDecoder.decode(this.bytes.subarray(start, end)),
    };
  }

  private readNumber(): Token {
    const { span, text } = this.readWhile((b) => Tokenizer.isDigit(b));

    return { kind: 'number', text, span };
  }

  private readIdentifier(): Token {
    const { span, text } = this.readWhile((b) => Tokenizer.isIdentifierLetter(b));
    const reservedKeyword = reservedKeywords.find((k) => k === text);

    if (reservedKeyword) {
      return { kind: 'keyword', text: reservedKeyword, span };
    }

    return { kind: 'identifier', text, span };
  }

  private readString(): Token {
    const start = this.index;
    const bytes: number[] = [];

    // skip the opening '
    this.index++;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const byte = this.peek();

      if (byte === undefined) {
        throw new Error(`unterminated string at ${start}`);
      }

      if (byte === asciiCodeMap["'"]) {
        this.index++;
        break;
      }

      if (byte === asciiCodeMap['\\']) {
        bytes.push(...this.readEscape());
        continue;
      }

      if (byte === asciiCodeMap.$ && this.bytes[this.index + 1] === asciiCodeMap['{']) {
        throw new Error(`template string is not implemented at ${this.index}`);
      }

      bytes.push(byte);
      this.index++;
    }

    return {
      kind: 'string',
      text: Tokenizer.textDecoder.decode(new Uint8Array(bytes)),
      span: { start, end: this.index },
    };
  }

  private readOperator(): Token {
    const start = this.index;
    const byte = this.peek();
    const operator = operators.find((o) => asciiCodeMap[o] === byte);

    if (!operator) {
      throw new Error(`expected operator at ${start}`);
    }

    this.index++;

    return { kind: 'operator', text: operator, span: { start, end: this.index } };
  }

  private readBracket(): Token {
    const start = this.index;
    const byte = this.peek();
    const bracket = brackets.find((b) => asciiCodeMap[b] === byte);

    if (!bracket) {
      throw new Error(`expected bracket at ${start}`);
    }

    const { currentKind, pair } = bracketPairMap[bracket];

    if (currentKind === 'close' && this.bracketStack.at(-1) !== pair) {
      throw new Error(`unmatched '${bracket}' at ${start}`);
    }

    if (currentKind === 'close') {
      this.bracketStack.pop();
    }

    if (currentKind === 'open') {
      this.bracketStack.push(bracket);
    }

    this.index++;

    return { kind: 'bracket', text: bracket, span: { start, end: this.index } };
  }

  private readComma(): Token {
    const start = this.index;

    if (this.peek() !== asciiCodeMap[',']) {
      throw new Error(`expected ',' at ${start}`);
    }

    this.index++;

    return { kind: 'comma', text: ',', span: { start, end: this.index } };
  }

  // Reads an escape starting at '\' and returns the bytes it stands for
  private readEscape() {
    if (this.peek() !== asciiCodeMap['\\']) {
      throw new Error(`expected '\\' at ${this.index}`);
    }

    const start = this.index;

    this.index++; // skip the '\'

    const byte = this.peek();

    if (byte === undefined) {
      throw new Error(`unterminated string at ${start}`);
    }

    const escaped = escapeMap.get(byte);

    if (escaped !== undefined) {
      this.index++;

      return Tokenizer.textEncoder.encode(escaped);
    }

    if (byte === asciiCodeMap.u) {
      this.index++;

      return Tokenizer.textEncoder.encode(
        String.fromCodePoint(this.readBracedUnicodeScalarValue(start)),
      );
    }

    throw new Error(`unknown escape '\\${String.fromCharCode(byte)}' at ${start}`);
  }

  // Reads {hex} and returns it after checking it is a Unicode scalar value
  private readBracedUnicodeScalarValue(start: number) {
    if (this.peek() !== asciiCodeMap['{']) {
      throw new Error(`expected '{' after '\\u' at ${start}`);
    }

    this.index++;

    const { text } = this.readWhile((b) => Tokenizer.isHexDigit(b));

    if (this.peek() !== asciiCodeMap['}']) {
      throw new Error(`expected '}' in unicode escape at ${start}`);
    }

    this.index++;

    const codePoint = Number.parseInt(text, 16);

    if (
      text.length < 1
      || 8 < text.length
      || (0xd800 <= codePoint && codePoint <= 0xdfff)
      || 0x10ffff < codePoint
    ) {
      throw new Error(`invalid unicode escape at ${start}`);
    }

    return codePoint;
  }

  nextToken(): Token | undefined {
    // skip whitespace
    this.readWhile((b) => Tokenizer.isInlineWhitespace(b));

    const byte = this.peek();

    if (byte === undefined) {
      const unclosed = this.bracketStack.at(-1);

      if (unclosed) {
        throw new Error(`unclosed '${unclosed}'`);
      }

      return undefined;
    }

    // Numbers must be handled first so that identifiers never start with a digit
    if (Tokenizer.isDigit(byte)) {
      return this.readNumber();
    }

    if (Tokenizer.isIdentifierLetter(byte)) {
      return this.readIdentifier();
    }

    if (Tokenizer.isStringQuote(byte)) {
      return this.readString();
    }

    if (Tokenizer.isOperator(byte)) {
      return this.readOperator();
    }

    if (Tokenizer.isBracket(byte)) {
      return this.readBracket();
    }

    if (Tokenizer.isComma(byte)) {
      return this.readComma();
    }

    throw new Error(`unexpected byte 0x${byte.toString(16)} at ${this.index}`);
  }
}
