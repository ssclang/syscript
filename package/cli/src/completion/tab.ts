import { RootCommand, ShellCompDirective } from '@bomb.sh/tab';
import { CommandNode, createOptionLookup, resolveAlias } from '~/command.js';
import { CliExitError } from '~/error.js';
import { ZCompletionShell } from '~/option.js';
import { Completion } from './completion.js';

export function printCompletionScript(
  name: string,
  shell: string,
  grouped?: { readonly command: CommandNode; readonly version: boolean },
) {
  const parsedShell = ZCompletionShell.safeParse(shell);
  if (!parsedShell.success) {
    throw CliExitError.userError(
      `unsupported shell: ${shell}; expected ${ZCompletionShell.options.join(', ')}`,
    );
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
    throw CliExitError.definitionError(`invalid completion program name: ${name}`);
  }
  if (grouped && parsedShell.data !== 'zsh') {
    throw CliExitError.userError('--grouped is supported only for zsh');
  }

  const styles =
    grouped ? formatGroupedZshStyles(name, grouped.command, grouped.version) : undefined;
  new RootCommand().setup(name, name, parsedShell.data);
  if (styles) console.log(styles);
}

/** tab renders one values tag in Zsh; scoped tag labels split its known semantic matches. */
function formatGroupedZshStyles(name: string, command: CommandNode, version: boolean) {
  const optionNames = new Set<string>();
  const valueNames = new Set<string>(['complete', ...ZCompletionShell.options]);

  function collect(node: CommandNode) {
    for (const [optionName] of createOptionLookup(node.options ?? [])) {
      optionNames.add(optionName.length === 1 ? `-${optionName}` : `--${optionName}`);
    }
    for (const item of [...(node.options ?? []), ...(node.args ?? [])]) {
      if (!item.complete || typeof item.complete === 'string') continue;
      for (const value of item.complete) valueNames.add(value);
    }
    for (const child of node.subcommands ?? []) {
      for (const alias of resolveAlias(child, 'command')) valueNames.add(alias);
      collect(child);
    }
  }

  collect(command);
  const ordinary = [...optionNames].filter((name) => !valueNames.has(name));
  const general = ['--help', ...(version ? ['--version'] : [])].filter(
    (name) => !valueNames.has(name),
  );
  const named = [...ordinary, ...general];
  const context = `:completion:*:*:${name}:*`;
  const labels = [
    ...(ordinary.length ? ['values:syscript-options:Options'] : []),
    ...(general.length ? ['values:syscript-general:General'] : []),
    'values:syscript-other *',
  ].join(' ');
  const lines = [
    `zstyle ${quoteZsh(context)} verbose true`,
    `zstyle ${quoteZsh(context)} list-grouped false`,
    `zstyle ${quoteZsh(context)} sort true`,
    `zstyle ${quoteZsh(context)} group-name ''`,
    `zstyle ${quoteZsh(context)} format '%d'`,
    `zstyle ${quoteZsh(context)} group-order syscript-options syscript-general syscript-other syscript-files`,
    `zstyle ${quoteZsh(context)} tag-order ${quoteZsh(labels)}`,
  ];

  if (ordinary.length) {
    lines.push(
      `zstyle ${quoteZsh(`${context}:syscript-options`)} ignored-patterns ${quoteZsh(`^(${ordinary.map(escapeZshPattern).join('|')})`)}`,
    );
  }
  if (general.length) {
    lines.push(
      `zstyle ${quoteZsh(`${context}:syscript-general`)} ignored-patterns ${quoteZsh(`^(${general.map(escapeZshPattern).join('|')})`)}`,
    );
  }
  if (named.length) {
    lines.push(
      `zstyle ${quoteZsh(`${context}:syscript-other`)} ignored-patterns ${quoteZsh(`(${named.map(escapeZshPattern).join('|')})`)}`,
    );
  }
  lines.push(
    `zstyle ${quoteZsh(`${context}:syscript-other`)} format ''`,
    `zstyle ${quoteZsh(`${context}:argument-rest`)} format 'Files'`,
    `zstyle ${quoteZsh(`${context}:argument-rest`)} group-name syscript-files`,
  );
  return lines.join('\n');
}

function escapeZshPattern(value: string) {
  if (/[\t\r\n\0]/.test(value)) {
    throw CliExitError.definitionError('completion value contains a control character');
  }
  return value.replace(/[\\^~#*?()[\]{}|<>]/g, '\\$&');
}

function quoteZsh(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** tab exposes its shell scripts and directives, but no public candidate serializer. */
export function formatCompletion(completion: Completion) {
  let directive: number = ShellCompDirective.ShellCompDirectiveNoFileComp;
  if (completion.files === 'file') directive = ShellCompDirective.ShellCompDirectiveDefault;
  if (completion.files === 'directory') directive = ShellCompDirective.ShellCompDirectiveFilterDirs;

  const prefix = completion.prefix && !completion.prefix.endsWith('=') ? completion.prefix : '';
  const rows = completion.candidates.map(({ value, description }) => {
    if (/[\t\r\n\0]/.test(value)) {
      throw CliExitError.definitionError('completion value contains a control character');
    }
    const safeDescription = (description ?? '').replace(/[\t\r\n\0]/g, ' ');
    return `${prefix}${value}\t${safeDescription}`;
  });

  return [...rows, `:${directive}`, ''].join('\n');
}
