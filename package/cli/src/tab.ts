import { RootCommand, ShellCompDirective } from '@bomb.sh/tab';
import { Completion } from '~/completion.js';
import { CliExitError } from '~/error.js';
import { ZCompletionShell } from '~/option.js';

export function printCompletionScript(name: string, shell: string) {
  const parsedShell = ZCompletionShell.safeParse(shell);
  if (!parsedShell.success) {
    throw CliExitError.userError(
      `unsupported shell: ${shell}; expected ${ZCompletionShell.options.join(', ')}`,
    );
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
    throw CliExitError.definitionError(`invalid completion program name: ${name}`);
  }

  new RootCommand().setup(name, name, parsedShell.data);
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
