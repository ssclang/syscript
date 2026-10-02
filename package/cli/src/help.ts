import { assert, NonEmptyArray } from '@syscript/share';
import { ArgumentNode, CommandNode, OptionNode, resolveAlias } from '~/command.js';

export type FormatHelpOption = {
  readonly version?: boolean;
};

export function formatHelp(commands: NonEmptyArray<CommandNode>, option: FormatHelpOption = {}) {
  const command = commands.at(-1);
  assert(command);

  const sections: string[] = [];

  if (command.description) {
    sections.push(command.description);
  }

  sections.push(`Usage: ${formatUsage(commands)}`);

  if (command.subcommands) {
    const rows = command.subcommands.map(
      (subcommand) =>
        [resolveAlias(subcommand, 'command').join(', '), subcommand.description] as const,
    );
    sections.push(formatSection('Commands', rows));
  }

  if (command.args?.length) {
    const rows = command.args.map((arg) => [formatArgument(arg), arg.description] as const);
    sections.push(formatSection('Arguments', rows));
  }

  const optionRows = (command.options || []).map(
    (option) => [formatOptionNames(option), formatOptionDescription(option)] as const,
  );
  const builtinRows = [
    ['--help', 'Print help'],
    ...(option.version ? [['--version', 'Print version'] as const] : []),
  ] as const;
  sections.push(formatSection('Options', [...optionRows, ...builtinRows]));

  return `${sections.join('\n\n')}\n`;
}

function formatUsage(commands: NonEmptyArray<CommandNode>) {
  const command = commands.at(-1);
  assert(command);

  const path = commands.map((node) => resolveAlias(node, 'command')[0]);
  const requiredOptions = (command.options || [])
    .filter((option) => option.required && option.defaultValue === undefined)
    .map(formatRequiredOption);
  const args = (command.args || []).map(formatArgument);
  const subcommand = command.subcommands ? ['[COMMAND]'] : [];

  return [...path, '[OPTIONS]', ...requiredOptions, ...args, ...subcommand].join(' ');
}

function formatSection(title: string, rows: readonly (readonly [string, string | undefined])[]) {
  const width = Math.max(...rows.map(([name]) => name.length));
  const lines = rows.map(([name, description]) =>
    `  ${name.padEnd(width)}  ${description || ''}`.trimEnd(),
  );

  return [`${title}:`, ...lines].join('\n');
}

export function formatArgument(arg: ArgumentNode) {
  return `<${formatValueName(arg.name)}>${arg.allowMultiple ? '...' : ''}`;
}

function formatValueName(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replaceAll('-', '_')
    .toUpperCase();
}

function formatFlag(name: string) {
  return name.length === 1 ? `-${name}` : `--${name}`;
}

function sortOptionNames(option: OptionNode) {
  const names = resolveAlias(option, 'option');

  return [...names.filter((name) => name.length === 1), ...names.filter((name) => name.length > 1)];
}

function formatOptionNames(option: OptionNode) {
  const names = sortOptionNames(option);
  const flags = names.map(formatFlag).join(', ');

  if (option.type !== 'boolean') {
    return `${flags} <${formatValueName(option.name)}>`;
  }

  if (!option.negative) {
    return flags;
  }

  const negativeNames =
    option.negative === true ? names.map((name) => `no-${name}`) : [option.negative];

  return `true: ${flags} | false: ${negativeNames.map(formatFlag).join(', ')}`;
}

export function formatRequiredOption(option: OptionNode) {
  const names = sortOptionNames(option);
  const name = names.find((value) => value.length > 1) || names[0];
  assert(name);

  const flag = formatFlag(name);

  return option.type === 'boolean' ? flag : `${flag} <${formatValueName(option.name)}>`;
}

function formatOptionDescription(option: OptionNode) {
  const { defaultValue } = option;
  const defaultText =
    defaultValue === undefined ? undefined
    : typeof defaultValue === 'object' ? defaultValue.join(' ')
    : String(defaultValue);

  return [option.description, defaultText === undefined ? undefined : `[default: ${defaultText}]`]
    .filter(Boolean)
    .join(' ');
}
