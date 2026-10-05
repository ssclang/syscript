import {
  ArgumentNode,
  CommandNode,
  CompletionSource,
  NumberOptionNode,
  OptionNode,
  StringOptionNode,
  createCommandLookup,
  createOptionLookup,
  isOption,
  parseBoolish,
  parseOptionNames,
  parseValue,
  validateCommand,
} from '~/command.js';
import { CliExitError } from '~/error.js';
import { ZCompletionShell } from '~/option.js';

export type CompletionCandidate = {
  readonly value: string;
  readonly description?: string | undefined;
};

export type Completion = {
  readonly candidates: readonly CompletionCandidate[];
  readonly files: 'none' | 'file' | 'directory';
  readonly prefix?: string;
};

export type CompletionOption = {
  readonly version?: boolean;
  readonly completion?: boolean;
};

type Context = {
  command: CommandNode;
  argCount: number;
  pendingOption?: NumberOptionNode | StringOptionNode;
  usedOptions: Set<OptionNode>;
};

const empty: Completion = { candidates: [], files: 'none' };

/** The last word is the unfinished word, possibly empty. The executable is excluded. */
export function getCompletion(
  root: CommandNode,
  words: readonly string[],
  option: CompletionOption = {},
): Completion {
  validateCommand(root);

  if (option.completion && createCommandLookup(root.subcommands ?? []).has('complete')) {
    throw CliExitError.definitionError('reserved command name: complete');
  }

  const previous = words.slice(0, -1);
  const current = words.at(-1) ?? '';

  if (option.completion && previous[0] === 'complete') {
    if (previous.length !== 1) return empty;
    return getValuesCompletion(ZCompletionShell.options, current);
  }

  const context = parseContext(root, previous, option.version === true);
  if (!context) return empty;

  if (context.pendingOption) {
    if (isOption(current)) return empty;
    return getValueCompletion(context.pendingOption, current);
  }

  if (current.startsWith('-'))
    return getOptionCompletion(context, current, option.version === true);
  return getArgumentCompletion(
    context,
    current,
    option.completion === true && previous.length === 0,
  );
}

function parseContext(root: CommandNode, words: readonly string[], hasVersion: boolean) {
  const context: Context = { command: root, argCount: 0, usedOptions: new Set() };

  for (const word of words) {
    if (context.pendingOption) {
      if (isOption(word) || !isValidOptionValue(context.pendingOption, word)) return undefined;
      context.pendingOption = undefined;
      continue;
    }

    if (word === '--') return undefined;

    if (isOption(word)) {
      const lookup = createOptionLookup(context.command.options ?? []);

      for (const part of parseOptionNames(word)) {
        if (part.long && part.inline === undefined) {
          if (part.name === 'help' || (hasVersion && part.name === 'version')) return undefined;
        }

        const entry = part.long && part.name.length < 2 ? undefined : lookup.get(part.name);
        if (!entry) return undefined;

        const { option } = entry;
        if (context.usedOptions.has(option) && !option.allowMultiple) return undefined;
        context.usedOptions.add(option);

        if (option.type === 'boolean') {
          if (part.inline !== undefined) {
            if (!option.allowBoolish || parseBoolish(part.inline) === undefined) return undefined;
          }
          continue;
        }

        const attached = part.inline ?? (part.rest || undefined);
        if (attached === undefined) {
          context.pendingOption = option;
          break;
        }
        if (!isValidOptionValue(option, attached)) return undefined;
        break;
      }
      continue;
    }

    const args = context.command.args ?? [];
    const multiple = args.at(-1)?.allowMultiple ? args.at(-1) : undefined;
    const fixedCount = args.length - (multiple ? 1 : 0);
    const children = createCommandLookup(context.command.subcommands ?? []);

    if (context.argCount < fixedCount || (multiple && !children.has(word))) {
      context.argCount++;
      continue;
    }

    if (context.argCount < args.length) return undefined;

    const child = children.get(word);
    if (!child || !hasRequiredOptions(context)) return undefined;
    context.command = child;
    context.argCount = 0;
    context.usedOptions.clear();
  }

  return context;
}

function hasRequiredOptions(context: Context) {
  return (context.command.options ?? []).every(
    (option) =>
      !option.required || option.defaultValue !== undefined || context.usedOptions.has(option),
  );
}

function isValidOptionValue(option: NumberOptionNode | StringOptionNode, value: string) {
  try {
    parseValue(option, value, value);
    return true;
  } catch (error) {
    if (error instanceof CliExitError) return false;
    throw error;
  }
}

function getOptionCompletion(context: Context, current: string, hasVersion: boolean): Completion {
  const lookup = createOptionLookup(context.command.options ?? []);
  const parts = parseOptionNames(current);
  const currentOptions = new Set(context.usedOptions);

  for (const part of parts) {
    const entry = part.long && part.name.length < 2 ? undefined : lookup.get(part.name);
    if (!entry) break;

    const { option } = entry;
    if (currentOptions.has(option) && !option.allowMultiple) return empty;
    currentOptions.add(option);

    if (part.inline !== undefined || (option.type !== 'boolean' && part.rest)) {
      if (option.type === 'boolean' && !option.allowBoolish) return empty;
      const value = part.inline ?? part.rest;
      return {
        ...getValueCompletion(option, value),
        prefix: current.slice(0, current.length - value.length),
      };
    }

    if (option.type !== 'boolean') break;
  }

  const candidates: CompletionCandidate[] = [];
  for (const [name, { option }] of lookup) {
    if (context.usedOptions.has(option) && !option.allowMultiple) continue;
    const value = name.length === 1 ? `-${name}` : `--${name}`;
    if (value.startsWith(current)) candidates.push({ value, description: option.description });
  }

  if ('--help'.startsWith(current)) candidates.push({ value: '--help', description: 'Print help' });
  if (hasVersion && '--version'.startsWith(current)) {
    candidates.push({ value: '--version', description: 'Print version' });
  }

  return { candidates, files: 'none' };
}

function getArgumentCompletion(
  context: Context,
  current: string,
  includeComplete: boolean,
): Completion {
  const args = context.command.args ?? [];
  const multiple = args.at(-1)?.allowMultiple ? args.at(-1) : undefined;
  const target = args[context.argCount] ?? multiple;
  const result = getValueCompletion(target, current);
  const children = createCommandLookup(context.command.subcommands ?? []);
  const candidates = result.candidates.filter(
    ({ value }) => !(target?.allowMultiple && children.has(value)),
  );

  if (context.argCount >= args.length && hasRequiredOptions(context)) {
    for (const [name, child] of children) {
      if (name.startsWith(current))
        candidates.push({ value: name, description: child.description });
    }
  }

  if (includeComplete && 'complete'.startsWith(current)) {
    candidates.push({ value: 'complete', description: 'Generate shell completion script' });
  }

  return {
    ...result,
    candidates: [...new Map(candidates.map((item) => [item.value, item])).values()],
  };
}

function getValueCompletion(
  node: ArgumentNode | OptionNode | undefined,
  current: string,
): Completion {
  if (!node) return empty;
  if (node.complete === 'file') return { candidates: [], files: 'file' };
  if (node.complete === 'directory') return { candidates: [], files: 'directory' };

  let source: CompletionSource | undefined = node.complete;
  if (!source && node.type === 'boolean' && node.allowBoolish) source = ['true', 'false'];
  if (!source || typeof source === 'string') return empty;
  return getValuesCompletion(source, current, node.description);
}

function getValuesCompletion(
  values: readonly string[],
  current: string,
  description?: string,
): Completion {
  const candidates = [...new Set(values)]
    .filter((value) => value.startsWith(current))
    .map((value) => ({ value, description }));
  return { candidates, files: 'none' };
}
