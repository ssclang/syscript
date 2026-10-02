import { assert } from '@syscript/share';
import { CliNode, CommandNode } from '~/command.js';

export type CliContextInit<T extends CliNode = CliNode> = {
  readonly current: T;
  readonly currentCommand: CommandNode;
  readonly currentCommands: readonly [CommandNode, ...CommandNode[]];
  readonly currentArgs: readonly string[];
  readonly restArgs: readonly string[];
  readonly options: ReadonlyMap<string, unknown>;
  readonly args: readonly unknown[];
};

export class CliContext<T extends CliNode = CliNode> {
  readonly current: T;
  readonly currentCommand: CommandNode;
  readonly currentCommands: readonly [CommandNode, ...CommandNode[]];
  readonly currentArgs: readonly string[];
  readonly restArgs: readonly string[];

  readonly #options: ReadonlyMap<string, unknown>;
  readonly #args: readonly unknown[];

  private constructor(init: CliContextInit<T>) {
    this.current = init.current;
    this.currentCommand = init.currentCommand;
    this.currentCommands = init.currentCommands;
    this.currentArgs = init.currentArgs;
    this.restArgs = init.restArgs;
    this.#options = init.options;
    this.#args = init.args;
  }

  static fromRoot(root: CommandNode, args: readonly string[]) {
    return new CliContext<CommandNode>({
      current: root,
      currentCommand: root,
      currentCommands: [root],
      currentArgs: [],
      restArgs: args,
      options: new Map(),
      args: [],
    });
  }

  static of(context: CliContext, command: CommandNode) {
    const [name, ...restArgs] = context.restArgs;

    assert(name === command.name, `expected command ${command.name}`);

    return new CliContext<CommandNode>({
      current: command,
      currentCommand: command,
      currentCommands: [...context.currentCommands, command],
      currentArgs: [...context.currentArgs, name],
      restArgs,
      options: new Map(),
      args: [],
    });
  }

  /** Options parsed so far for `currentCommand`. A flag has `true` as its value. */
  getOptions() {
    return this.#options;
  }

  /** Arguments parsed so far for `currentCommand`. */
  getArgs() {
    return this.#args;
  }
}
