export type CliExitErrorType = 'default' | 'user' | 'definition';

export class CliExitError extends Error {
  readonly type: CliExitErrorType;
  readonly exitCode: number;

  constructor(message?: string, exitCode = 1, type: CliExitErrorType = 'default') {
    super(message);
    this.exitCode = exitCode;
    this.type = type;
  }

  static default(message: string) {
    return new CliExitError(message);
  }

  static userError(message: string) {
    return new CliExitError(message, 2, 'user');
  }

  static definitionError(message: string) {
    return new CliExitError(`invalid definition: ${message}`, 1, 'definition');
  }

  static unknown(unknown: unknown, type: CliExitErrorType = 'default') {
    const message = unknown instanceof Error ? unknown.message : String(unknown);
    return new CliExitError(message, 1, type);
  }

  static silent(exitCode?: number, type: CliExitErrorType = 'default') {
    return new CliExitError(undefined, exitCode, type);
  }
}
