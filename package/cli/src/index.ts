import {
  CommandNode,
  createCommandLookup,
  parseCli,
  parseRawArgv,
  resolveAlias,
  validateCommand,
} from '~/command.js';
import { getCompletion } from '~/completion.js';
import { CliExitError } from '~/error.js';
import { tryLintUnnecessaryOption } from '~/lint.js';
import { debugConsole, logError } from '~/log.js';
import { InputCliOption, ZCliOption, ZCompletionShell } from '~/option.js';
import { formatCompletion, printCompletionScript } from '~/tab.js';

export { createCommand } from '~/command.js';
export { CliExitError } from '~/error.js';
export { getCompletion } from '~/completion.js';
export type { Completion, CompletionCandidate } from '~/completion.js';

export async function runCli(command: CommandNode, option?: InputCliOption) {
  const normalizedOption = ZCliOption.parse(option || {});
  const args = normalizedOption.argv.slice(2);
  const isCompletionRequest = normalizedOption.completion && args[0] === 'complete';

  if (!isCompletionRequest) tryLintUnnecessaryOption(option, normalizedOption);

  if (normalizedOption.debug && !isCompletionRequest) {
    // const raw = {
    //   argv0: process.argv0,
    //   argv: process.argv,
    //   execArgv: process.execArgv,
    // } as const;
    const input = parseRawArgv(normalizedOption.argv);
    debugConsole.dir({ option: normalizedOption, input }, { depth: undefined });
  }

  const result =
    isCompletionRequest ?
      Promise.resolve().then(() =>
        runCompletion(command, args, normalizedOption.version !== undefined),
      )
    : parseCli(command, normalizedOption.argv, {
        version: normalizedOption.version,
        completion: normalizedOption.completion,
      });

  const exitCode = await result
    .catch((e: unknown) => {
      if (normalizedOption.handleError) {
        return normalizedOption.handleError(e);
      }
      throw e;
    })
    .then((r) => r || 0)
    .catch((e: unknown) => {
      if (e instanceof CliExitError) {
        if (e.message) {
          logError(e.message);
        }
        return e.exitCode;
      }

      if (normalizedOption.debug) {
        debugConsole.error(e);
      } else {
        logError('unexpected error: enable debug option to see more details');
      }

      return CliExitError.unknown(e).exitCode;
    });

  if (normalizedOption.setExitCode) {
    process.exitCode = exitCode;
  }

  return exitCode;
}

function runCompletion(command: CommandNode, args: readonly string[], version: boolean) {
  if (args[1] === '--') {
    const words = args.slice(2);
    const completion = getCompletion(command, words.length ? words : [''], {
      version,
      completion: true,
    });
    process.stdout.write(formatCompletion(completion));
    return 0;
  }

  validateCommand(command);
  if (createCommandLookup(command.subcommands ?? []).has('complete')) {
    throw CliExitError.definitionError('reserved command name: complete');
  }

  if (args.length !== 2 || args[1] === undefined) {
    throw CliExitError.userError(`usage: complete <${ZCompletionShell.options.join('|')}>`);
  }

  printCompletionScript(resolveAlias(command, 'command')[0], args[1]);
  return 0;
}
