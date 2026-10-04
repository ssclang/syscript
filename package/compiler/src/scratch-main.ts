import { CliExitError } from '@syscript/cli';
import { logError, logWarn } from '~/log.js';
import { App } from '~/ts/ts-app.js';
import { TsParser } from '~/ts/ts-parserv2.js';
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
  const entryPath = await parseInputFilePath({
    label: 'entry',
    path: 'test/fixture/main.ts',
  });
  const configFilePath = undefined;
  const preludePath = await Path.real(
    Path.absolute({
      baseDir: await Path.moduleDir(import.meta),
      path: '../../../prelude/prelude.d.ts',
    }),
  );
  const tsserverPath = Path.absolute({
    baseDir: await Path.moduleDir(import.meta),
    path: '../../../../ssclang/TypeScript/built/local/tsc',
  });
  const parser = await TsParser.init({ entryPath, configFilePath, preludePath, tsserverPath });

  App.initV2(parser, 'debug');
}

await main().catch((e: unknown) => {
  if (e instanceof CliExitError) {
    logError(e.message);
    process.exit(e.exitCode);
  }

  throw e;
});
