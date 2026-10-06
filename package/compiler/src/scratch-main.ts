import { CliExitError } from '@syscript/cli';
import { Env } from '@syscript/share/util';
import { logError, logWarn, printLine } from '~/log.js';
import { App } from '~/ts/ts-app.js';
import { TsParser } from '~/ts/ts-parser.js';
import { File } from '~/util/file.js';
import { Path } from '~/util/path.js';

async function parseInputFilePath(option: { label: string; path: string }) {
  const { label, path } = option;
  const absolutePath = Path.absolute({ path });

  if (!(await File.exists(absolutePath))) {
    throw CliExitError.userError(`${label} not found: ${absolutePath}`);
  }

  const realPath = await Path.real(absolutePath);

  if (realPath !== absolutePath) {
    logWarn(`${absolutePath} is not a real path, ${realPath} will be used`);
  }

  if (await File.exists(realPath, 'directory')) {
    throw CliExitError.userError(`${label} is a directory: ${realPath}`);
  }

  return realPath;
}

async function main() {
  const log = 'debug' as const satisfies App['log'];

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (log === 'debug') {
    printLine();
    Env.log('NODE_ENV');
    printLine();
  }

  const tsserverPath = await Path.real(
    Path.absolute({
      baseDir: await Path.moduleDir(import.meta),
      path: '../../../../ssclang/TypeScript/built/local/tsc',
    }),
  );
  const preludePath = await Path.real(
    Path.absolute({
      baseDir: await Path.moduleDir(import.meta),
      path: '../../../prelude/prelude.d.ts',
    }),
  );
  const entryPath = await parseInputFilePath({
    label: 'entry',
    path: 'test/fixture/main.ts',
  });
  const configFilePath = undefined;
  const parser = await TsParser.init({ tsserverPath, preludePath, entryPath, configFilePath });

  App.init(log, parser);
}

await main().catch((e: unknown) => {
  if (e instanceof CliExitError) {
    logError(e.message);
    process.exit(e.exitCode);
  }

  throw e;
});
