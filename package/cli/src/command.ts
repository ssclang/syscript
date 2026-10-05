import { MaybePromise, NonEmptyArray } from '@syscript/share/type';
import { zNumberString } from '@syscript/share/zod';
import assert from 'node:assert/strict';
import { CliExitError } from '~/error.js';
import { formatArgument, formatHelp, formatRequiredOption } from '~/help.js';

// type PrimitiveType = boolean | number | string;

// type ZodPrimitiveType = z.ZodBoolean | z.ZodNumber | z.ZodString;

// z.ZodString;
export type CliNode = CommandNode | ArgumentNode | OptionNode;

export type CompletionSource = readonly string[] | 'file' | 'directory';

type BaseNode = {
  readonly name: string;
  readonly description?: string;
  // readonly help?: (context: CliContext) => string; // string 대신 구조화 필요
  // readonly complete?: (context: CliContext) => MaybePromise<string[]>;
};

export type CommandNode<
  T extends readonly OptionNode[] = readonly OptionNode[],
  U extends readonly ArgumentNode[] = readonly ArgumentNode[],
> = BaseNode & {
  readonly alias?: NonEmptyArray<string>;
  readonly args?: U;
  readonly options?: T;
  // readonly run: (context: CliContext<CommandNode>) => MaybePromise<number | undefined>;
  run(args: ArgsOf<U>, options: OptionsOf<T>): MaybePromise<number | undefined>;

  readonly subcommands?: NonEmptyArray<CommandNode>;
};

export type ArgumentNode = BooleanArgumentNode | NumberArgumentNode | StringArgumentNode;

export type BaseArgumentNode = BaseNode & {
  readonly complete?: CompletionSource;
  readonly type: 'boolean' | 'number' | 'string';
  readonly allowMultiple?: true;
};

export type BooleanArgumentNode = BaseArgumentNode & {
  readonly type: 'boolean';
  readonly allowBoolish?: boolean;
};

export type NumberArgumentNode = BaseArgumentNode & {
  readonly type: 'number';
};

export type StringArgumentNode = BaseArgumentNode & {
  readonly type: 'string';
};

export type ArgumentValue<T extends ArgumentNode = ArgumentNode> =
  T extends { readonly allowMultiple: true } ? OptionValueMap[T['type']][]
  : T extends { readonly type: string; readonly allowMultiple?: undefined } ?
    OptionValueMap[T['type']]
  : OptionValueMap[T['type']] | OptionValueMap[T['type']][];

export type ArgsOf<T extends readonly ArgumentNode[]> = {
  readonly [K in keyof T]: { readonly name: T[K]['name']; readonly value: ArgumentValue<T[K]> };
};

export type OptionNode = BooleanOptionNode | NumberOptionNode | StringOptionNode;

type OptionValueMap = {
  boolean: boolean;
  number: number;
  string: string;
};

type PrimitiveValue = OptionValueMap[keyof OptionValueMap];

export type OptionValue<T extends OptionNode = OptionNode> =
  T extends { readonly allowMultiple: true } ? readonly OptionValueMap[T['type']][]
  : OptionValueMap[T['type']];

type OptionalOf<T extends OptionNode> =
  T extends (

      | { readonly allowMultiple: true }
      | { readonly required: true }
      | { readonly defaultValue: PrimitiveValue | readonly PrimitiveValue[] }
  ) ?
    never
  : undefined;

export type OptionsOf<T extends readonly OptionNode[]> = {
  [K in T[number] as K['name']]: OptionValue<K> | OptionalOf<K>;
};

export type BaseOptionNode = BaseNode & {
  readonly complete?: CompletionSource;
  readonly type: 'boolean' | 'number' | 'string';
  /**
   * names used on the command line, replacing `name`
   *
   * Without `alias`, `name` is used instead.
   */
  readonly alias?: NonEmptyArray<string>;
  // readonly value: PrimitiveType;
  readonly required?: true;
};

export type BooleanOptionNode = BaseOptionNode & {
  readonly type: 'boolean';
  /**
   * add a negative flag that sets the value to `false`
   *
   * `true` adds `--no-<name>` for each name from `alias`, and a string is used as the negative flag name instead.
   * The negative flag is always long, so a one-letter name `x` gets `--no-x`,
   * and a string must have at least two letters.
   * When neither flag is given, the value is `defaultValue`, or `undefined` if not set.
   * Using both the flag and its negative flag is an error, as is any repeated option,
   * unless `allowMultiple` is set.
   */
  readonly negative?: true | string;
  readonly allowBoolish?: boolean;
} & (
    | {
        readonly allowMultiple?: false;
        /**
         * value used when the flag is not given, or `undefined` if not set
         */
        readonly defaultValue?: boolean;
      }
    | { readonly allowMultiple: true; readonly defaultValue?: readonly boolean[] }
  );

export type NumberOptionNode = BaseOptionNode & {
  readonly type: 'number';
} & (
    | { readonly allowMultiple?: false; readonly defaultValue?: number }
    | { readonly allowMultiple: true; readonly defaultValue?: readonly number[] }
  );

export type StringOptionNode = BaseOptionNode & {
  readonly type: 'string';
} & (
    | { readonly allowMultiple?: false; readonly defaultValue?: string }
    | { readonly allowMultiple: true; readonly defaultValue?: readonly string[] }
  );

export function parseRawArgv(argv = process.argv) {
  const [program, entry, ...args] = argv;

  assert(program, 'missing program');
  assert(entry, 'missing entry');

  return { program, entry, args } as const;
}

// export type CommandNode = BaseNode & {
//   readonly alias?: NonEmptyArray<string>;
//   readonly arguments?: NonEmptyArray<ArgumentNode>;
//   readonly options?: NonEmptyArray<OptionNode>;
//   readonly run: (context: CliContext<CommandNode>) => MaybePromise<number | undefined>;
//   readonly subcommands: readonly CommandNode[];
// };

// function help(command: CommandNode): never {
//   throw ExitError.userError('missing command name');
// }

export function createCommand<
  const T extends readonly OptionNode[] = [],
  const U extends readonly ArgumentNode[] = [],
>(command: CommandNode<T, U>) {
  return command;
}

export function validateCommand(command: CommandNode) {
  const multipleArgIndex = (command.args || []).findIndex((arg) => arg.allowMultiple);
  const argAfterMultiple = multipleArgIndex < 0 ? undefined : command.args?.[multipleArgIndex + 1];

  if (argAfterMultiple) {
    throw CliExitError.definitionError(
      `argument after multiple argument: ${argAfterMultiple.name}`,
    );
  }

  const argNames = new Set<string>();
  const duplicateArgNameSet = new Set<string>();

  for (const { name } of command.args || []) {
    if (argNames.has(name)) {
      duplicateArgNameSet.add(name);
    }

    argNames.add(name);
  }

  if (duplicateArgNameSet.size) {
    const duplicateArgNames = duplicateArgNameSet.values().toArray().sort().join(', ');
    throw CliExitError.definitionError(`duplicate argument name: ${duplicateArgNames}`);
  }

  createOptionLookup(command.options || []);
  createCommandLookup(command.subcommands || []);

  for (const subcommand of command.subcommands || []) {
    validateCommand(subcommand);
  }
}

export type ParseCliOption = {
  readonly version?: string | (() => MaybePromise<string>);
  readonly completion?: boolean;
};

export async function parseCli(
  command: CommandNode,
  argv = process.argv,
  parseOption: ParseCliOption = {},
) {
  validateCommand(command);

  const { args: inputArgs } = parseRawArgv(argv);
  let currentCommand = command;
  const subcommandPath: CommandNode[] = [];
  let index = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const definedArgs = currentCommand.args || [];
    const definedOptions = currentCommand.options || [];

    const optionLookup = createOptionLookup(definedOptions);
    const commandLookup = createCommandLookup(currentCommand.subcommands || []);
    const multipleArg = definedArgs.at(-1)?.allowMultiple ? definedArgs.at(-1) : undefined;
    const fixedArgCount = definedArgs.length - (multipleArg ? 1 : 0);
    const foundArgs: string[] = [];
    const foundOptions = new Map<string, PrimitiveValue | PrimitiveValue[]>();

    const setOption = (option: OptionNode, value: PrimitiveValue, display: string) => {
      const found = foundOptions.get(option.name);

      if (option.allowMultiple) {
        foundOptions.set(option.name, Array.isArray(found) ? [...found, value] : [value]);
        return;
      }

      if (found !== undefined) {
        throw CliExitError.userError(`duplicate option: ${display}`);
      }

      foundOptions.set(option.name, value);
    };

    const addOption = (arg: string, nextArg: string | undefined) => {
      for (const { name, display, long, inline, rest } of parseOptionNames(arg)) {
        if (long && inline === undefined && name === 'help') {
          return 'help';
        }

        if (
          long
          && inline === undefined
          && name === 'version'
          && parseOption.version !== undefined
        ) {
          return 'version';
        }

        const entry = long && name.length < 2 ? undefined : optionLookup.get(name);

        if (!entry) {
          throw CliExitError.userError(`unknown option: ${display}`);
        }

        const { option } = entry;

        if (option.type === 'boolean') {
          let value = entry.value;

          if (inline !== undefined) {
            if (!option.allowBoolish) {
              throw CliExitError.userError(`option does not take a value: ${display}`);
            }

            const parsed = parseBoolish(inline);

            if (parsed === undefined) {
              throw CliExitError.userError(`invalid boolean value: ${display}`);
            }

            value = entry.value === parsed;
          }

          setOption(option, value, display);
          continue;
        }

        const attached = inline ?? (rest || undefined);

        if (attached !== undefined) {
          setOption(option, parseValue(option, attached, arg), display);
          return 0;
        }

        if (nextArg === undefined || isOption(nextArg)) {
          throw CliExitError.userError(`missing value: ${display}`);
        }

        setOption(option, parseValue(option, nextArg, `${display} ${nextArg}`), display);
        return 1;
      }

      return 0;
    };

    while (index < inputArgs.length) {
      const arg = inputArgs[index];
      assert(arg !== undefined);

      if (isDoubleDash(arg)) {
        throw CliExitError.default('not implemented: double dash');
      }

      if (isOption(arg)) {
        const consumed = addOption(arg, inputArgs[index + 1]);

        if (consumed === 'help') {
          const helpOption = {
            version: parseOption.version !== undefined,
            completion: parseOption.completion === true && subcommandPath.length === 0,
          };
          process.stdout.write(formatHelp([command, ...subcommandPath], helpOption));
          return 0;
        }

        if (consumed === 'version') {
          const version =
            typeof parseOption.version === 'function' ?
              await parseOption.version()
            : parseOption.version;
          process.stdout.write(`${resolveAlias(command, 'command')[0]} ${version}\n`);
          return 0;
        }

        index += consumed;
      } else if (foundArgs.length < fixedArgCount || (multipleArg && !commandLookup.has(arg))) {
        foundArgs.push(arg);
      } else {
        break;
      }

      index++;
    }

    if (foundArgs.length < definedArgs.length) {
      const missingArgs = definedArgs.slice(foundArgs.length).map(formatArgument).join(', ');
      throw CliExitError.userError(`missing required arguments: ${missingArgs}`);
    }

    const isMissing = (option: OptionNode) =>
      option.required && !foundOptions.has(option.name) && option.defaultValue === undefined;
    const missingOptions = definedOptions.filter(isMissing);

    if (missingOptions.length) {
      const names = missingOptions.map(formatRequiredOption).join(', ');
      throw CliExitError.userError(`missing required options: ${names}`);
    }

    const next = inputArgs[index];

    if (next === undefined) {
      const optionValues = Object.fromEntries(
        definedOptions.map((option) => [
          option.name,
          foundOptions.get(option.name)
            ?? option.defaultValue
            ?? (option.allowMultiple ? [] : undefined),
        ]),
      );

      const argValues = definedArgs.map((arg, argIndex) => {
        if (arg.allowMultiple) {
          const values = foundArgs.slice(argIndex).map((value) => parseValue(arg, value, value));
          return { name: arg.name, value: values };
        }

        const value = foundArgs[argIndex];
        assert(value !== undefined);

        return { name: arg.name, value: parseValue(arg, value, value) };
      });

      return currentCommand.run(
        argValues as ArgsOf<readonly ArgumentNode[]>,
        optionValues as OptionsOf<readonly OptionNode[]>,
      );
    }

    const subcommand = commandLookup.get(next);

    if (!subcommand) {
      throw CliExitError.userError(
        currentCommand.subcommands ? `unknown command: ${next}` : `unexpected argument: ${next}`,
      );
    }

    currentCommand = subcommand;
    subcommandPath.push(subcommand);
    index++;
  }
}

export function resolveAlias(node: CommandNode | OptionNode, kind: 'command' | 'option') {
  if (node.alias?.length === 0) {
    throw CliExitError.definitionError(`empty ${kind} alias: ${node.name}`);
  }

  return node.alias || [node.name];
}

export function createCommandLookup(commands: readonly CommandNode[]) {
  const lookup = new Map<string, CommandNode>();

  for (const command of commands) {
    for (const name of resolveAlias(command, 'command')) {
      if (lookup.has(name)) {
        throw CliExitError.definitionError(`duplicate command name: ${name}`);
      }

      lookup.set(name, command);
    }
  }

  return lookup;
}

export function createOptionLookup(options: readonly OptionNode[]) {
  const lookup = new Map<string, { option: OptionNode; value: boolean }>();

  const register = (name: string, option: OptionNode, value: boolean) => {
    if (name === 'help' || name === 'version') {
      throw CliExitError.definitionError(`reserved option name: ${name}`);
    }

    if (lookup.has(name)) {
      throw CliExitError.definitionError(`duplicate option name: ${name}`);
    }

    lookup.set(name, { option, value });
  };

  for (const option of options) {
    const names = resolveAlias(option, 'option');

    for (const name of names) {
      register(name, option, true);
    }

    if (option.type === 'boolean' && option.negative) {
      if (option.negative !== true && option.negative.length < 2) {
        throw CliExitError.definitionError(
          `negative option name must have at least two letters: ${option.negative}`,
        );
      }

      const negativeNames =
        option.negative === true ? names.map((name) => `no-${name}`) : [option.negative];

      for (const name of negativeNames) {
        register(name, option, false);
      }
    }
  }

  return lookup;
}

function isDoubleDash(arg: string): boolean {
  return arg === '--';
}

export function isOption(arg: string): boolean {
  return (arg.startsWith('--') && arg.length > 2) || (arg.startsWith('-') && arg.length > 1);
}

export function parseOptionNames(arg: string) {
  if (arg.startsWith('--')) {
    const separator = arg.indexOf('=');
    const name = separator < 0 ? arg.slice(2) : arg.slice(2, separator);
    const inline = separator < 0 ? undefined : arg.slice(separator + 1);

    return [{ name, display: arg, long: true, inline, rest: '' }];
  }

  const names = arg.slice(1).split('');

  return names.map((name, index) => ({
    name,
    display: `-${name}`,
    long: false,
    inline: undefined,
    rest: names.slice(index + 1).join(''),
  }));
}

export function parseValue(
  node: ArgumentNode | NumberOptionNode | StringOptionNode,
  value: string,
  display: string,
) {
  if (node.type === 'string') {
    return value;
  }

  if (node.type === 'boolean') {
    const parsed =
      node.allowBoolish ? parseBoolish(value)
      : value === 'true' ? true
      : value === 'false' ? false
      : undefined;

    if (parsed === undefined) {
      throw CliExitError.userError(`invalid boolean value: ${display}`);
    }

    return parsed;
  }

  if (!zNumberString({ parser: 'int' }).safeParse(value).success) {
    throw CliExitError.userError(`invalid number value: ${display}`);
  }

  return Number(value);
}

export function parseBoolish(value: string) {
  const truthyValues = new Set(['true', '1', 'on', 'yes', 'y', 'o', 'enable', 'enabled', 'active']);
  const falsyValues = new Set([
    'false',
    '0',
    'off',
    'no',
    'n',
    'x',
    'disable',
    'disabled',
    'inactive',
  ]);
  const normalized = value.toLowerCase();

  if (truthyValues.has(normalized)) {
    return true;
  }

  if (falsyValues.has(normalized)) {
    return false;
  }

  return undefined;
}
