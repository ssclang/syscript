import { assert, assertNever } from '@syscript/share/util';

export class CppWriter {
  private indentStep = 0;
  private readonly _lines: string[] = [];
  private buffer?: string = undefined;

  clear() {
    this.indentStep = 0;
    this._lines.length = 0;
    this.buffer = undefined;
  }

  private append(code: string, flush: boolean) {
    this.buffer = this.buffer !== undefined ? this.buffer : ' '.repeat(this.indentStep);
    this.buffer += code;

    if (flush) {
      this.flush();
    }
  }

  inline(code = '') {
    this.append(code, false);
  }

  newline(code = '') {
    this.append('', true);
    this.append(code, false);
  }

  block(label: string, lines: () => string[]) {
    if (label) {
      this.inline(`${label} {`);
    } else {
      this.inline(`{`);
    }

    this.indent('in');

    lines().forEach((l) => this.newline(l));

    this.indent('out');
    this.newline('}');
  }

  flush() {
    if (this.buffer === undefined) {
      return;
    }

    this._lines.push(this.buffer);
    this.buffer = undefined;
  }

  indent(type: 'in' | 'out') {
    if (type === 'in') {
      this.indentStep += 2;
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (type === 'out') {
      assert(this.indentStep >= 2);
      this.indentStep -= 2;
      return;
    }

    assertNever(type);
  }

  code() {
    this.flush();
    return this._lines.map((l) => l.trimEnd()).join('\n');
  }

  lines() {
    this.flush();
    return this._lines;
  }
}
