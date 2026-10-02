import { CommandNode, parseCli, parseRawArgv } from '~/command.js';
import { CliExitError } from '~/error.js';
import { tryLintUnnecessaryOption } from '~/lint.js';
import { debugConsole, logError } from '~/log.js';
import { InputCliOption, ZCliOption } from '~/option.js';

export { createCommand } from '~/command.js';
export { CliExitError } from '~/error.js';

export async function runCli(command: CommandNode, option?: InputCliOption) {
  const normalizedOption = ZCliOption.parse(option || {});

  tryLintUnnecessaryOption(option, normalizedOption);

  if (normalizedOption.debug) {
    // const raw = {
    //   argv0: process.argv0,
    //   argv: process.argv,
    //   execArgv: process.execArgv,
    // } as const;
    const input = parseRawArgv(normalizedOption.argv);
    debugConsole.dir({ option: normalizedOption, input }, { depth: undefined });
  }

  const exitCode = await parseCli(command, normalizedOption.argv, {
    version: normalizedOption.version,
  })
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
