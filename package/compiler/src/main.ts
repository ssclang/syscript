import { CliExitError, createCommand, runCli } from '@syscript/cli';
import cp from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logError, logSuccess, logWarn, printLine } from '~/log.js';
import { SscBuildManager } from '~/ssc/manager/build.js';
import { SscManager } from '~/ssc/manager/ssc.js';
import { checkPathLeak } from '~/ssc/path-leak.js';
import { File } from '~/util/file.js';

async function clean(buildManager: SscBuildManager) {
  const { outDir, markerPath } = buildManager;

  if (!(await File.exists(outDir))) {
    logWarn(`nothing to clean: ${outDir}`);
    return 0;
  }

  if (!(await File.exists(outDir, 'directory'))) {
    logError(`error: not a directory: ${outDir}`);
    return 1;
  }

  if (!(await File.exists(markerPath, 'file'))) {
    logError(`error: missing .ssc file, check it before rebuild: ${markerPath}`);
    return 1;
  }

  if ((await File.read(markerPath)).trim() !== markerPath) {
    logError(`error: invalid .ssc file, check it before rebuild: ${markerPath}`);
    return 1;
  }

  await fs.rm(outDir, { recursive: true, force: true });

  logSuccess(`clean: ${outDir}`);

  return 0;
}

async function main({
  entryPath,
  binPath,
  dry,
  run,
  debug,
  profile,
}: {
  entryPath: string;
  binPath: string | undefined;
  dry: boolean;
  run: boolean;
  debug: boolean;
  profile: 'dev' | 'release';
}) {
  const manager = await SscManager.init({ profile }); // TODO: option support
  const buildManager = manager.buildManager;

  if (entryPath === 'clean') {
    return clean(buildManager);
  }

  const { app, modules } = await buildManager.compile(entryPath).then(async (r) => {
    await manager.flush();
    return r;
  });

  if (dry) {
    if (run) {
      logWarn("'--run' flag ignored in dry mode");
      printLine();
    }
    return undefined;
  }

  const emitBinPath = await buildManager.emit(modules, { entryPath, debug });

  logSuccess(`bin: ${emitBinPath}`);
  printLine();

  await checkPathLeak({
    binPath: emitBinPath,
    sourceFiles: app.sourceFiles,
    codeDir: buildManager.codeDir,
    sensitivePaths: [
      manager.outDir,
      manager.idManager.idJsonPath,
      manager.buildManager.preludeDir,
      manager.buildManager.preludeTsDefinitionPath,
    ],
    debug,
  });

  const resolvedBinPath = binPath ? path.resolve(binPath) : emitBinPath;

  if (binPath) {
    await File.copy(emitBinPath, resolvedBinPath, true);
    logSuccess(`copy: ${resolvedBinPath}`);
    printLine();
  }

  if (!run) {
    return undefined;
  }

  const result = cp.spawnSync(resolvedBinPath, { stdio: 'inherit' });

  printLine();
  console.log(result);
  printLine();

  return undefined;
}

const command = createCommand({
  name: 'ssc',
  args: [{ name: 'entryPath', type: 'string' }],
  options: [
    { name: 'binPath', type: 'string', alias: ['o', 'binPath'] },
    { name: 'dry', type: 'boolean', defaultValue: false },
    { name: 'run', type: 'boolean', defaultValue: false },
    { name: 'debug', type: 'boolean', defaultValue: false },
    { name: 'profile', type: 'string', defaultValue: 'dev' },
    { name: 'log', type: 'string', defaultValue: 'log' },
  ],
  run: async ([{ value: entryPath }], { binPath, dry, run, debug, profile, log }) => {
    if (profile !== 'dev' && profile !== 'release') {
      throw CliExitError.userError(`invalid profile: ${profile}`);
    }

    if (log !== 'log' && log !== 'debug') {
      throw CliExitError.userError(`invalid log: ${log}`);
    }

    return main({ entryPath, binPath, dry, run, debug, profile });
  },
});

await runCli(command);
