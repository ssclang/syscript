import * as ast from 'typescript7/unstable/ast';
import { AppSourceFile } from '~/ts/ts-node.js';
import { TsParser } from '~/ts/ts-parserv2.js';
import { RealPath } from '~/util/path.js';

export class App {
  private readonly log: 'log' | 'debug';
  readonly parser: TsParser;
  private readonly sourceFileMap = new Map<RealPath, AppSourceFile>();
  private sourceFileCounter = 0;

  readonly preludeSourceFile: AppSourceFile;
  readonly entrySourceFile: AppSourceFile;

  private constructor(log: App['log'], parser: TsParser) {
    this.parser = parser;
    this.log = log;

    this.preludeSourceFile = this.loadSourceFile(parser.getSourceFile(parser.preludePath));
    this.entrySourceFile = this.loadSourceFile(parser.getSourceFile(parser.entryPath));

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.log) {
      //
    }
  }

  static init(log: App['log'], parser: TsParser) {
    return new App(log, parser);
  }

  get api() {
    return this.parser.api;
  }

  get program() {
    return this.parser.program;
  }

  get checker() {
    return this.parser.checker;
  }

  get sourceFiles() {
    return this.sourceFileMap.values().toArray();
  }

  loadSourceFile(tsSourceFile: ast.SourceFile) {
    const realPath = this.parser.tsPathToRealPath(tsSourceFile.fileName);
    const cache = this.sourceFileMap.get(realPath);

    if (cache) {
      return cache;
    }

    const sourceFile = new AppSourceFile(this, tsSourceFile, this.sourceFileCounter++, realPath);

    this.sourceFileMap.set(realPath, sourceFile);

    return sourceFile;
  }
}
