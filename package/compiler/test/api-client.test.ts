import { assert } from '@syscript/share/util';
import path from 'path';
import * as ts from 'typescript7/sync';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { ApiClient } from '~/ts/api.js';
import { PathResolver } from '~/util/path-resolver.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');
const configFilePath = path.join(fixtureDir, 'tsconfig.json');
const entryPath = path.join(fixtureDir, 'main.ts');
const compilerOptions = { noLib: true };
const option = { tsserverPath: PathResolver.tsServerPath(), cwd: fixtureDir };
const clientOption = { addonPath: PathResolver.tscAddonPath(), cwd: fixtureDir };

let library: ts.API;
let client: ApiClient;

beforeAll(() => {
  library = new ts.API(option);
  client = new ApiClient(clientOption);
});

afterAll(() => {
  library.close();
});

function createProgram() {
  const response = client.request('createSnapshot', {
    createPrograms: [{ rootFiles: [entryPath], compilerOptions }],
  });
  const project = response.operation.createdPrograms?.[0];

  assert(project, 'createSnapshot did not return a program');

  return { snapshot: response.snapshot, project };
}

test('initialize', () => {
  library.parseConfigFile(configFilePath);

  expect(client.request('initialize', null)).toMatchObject({
    currentDirectory: library.getCurrentDirectory(),
  });
});

test('parseConfigFile', () => {
  const expected = library.parseConfigFile(configFilePath);

  expect(client.request('parseConfigFile', { file: configFilePath })).toEqual(expected);
});

test('getSourceFileNames', () => {
  const expected = library.createProgram([entryPath], compilerOptions).getSourceFileNames();

  expect(client.request('getSourceFileNames', createProgram())).toEqual(expected);
});

test('getSourceFile', () => {
  const sourceFile = library.createProgram([entryPath], compilerOptions).getSourceFile(entryPath);
  const { view } = sourceFile as unknown as { view: DataView };
  const expected = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  const response = client.request('getSourceFile', { ...createProgram(), file: entryPath });

  expect(Buffer.from(response?.data || '', 'base64')).toEqual(expected);
});
