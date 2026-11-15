import { assert } from '@syscript/share/util';
import fs from 'fs/promises';

type CompileOption = {
  outDir: string;
  type: 'bin' | 'lib';
};

export async function compile(entryPath: string, option: CompileOption) {
  const { outDir: _, type } = option;

  assert(type === 'bin');

  const source = await fs.readFile(entryPath, 'utf8');

  assert(source);

  return Promise.resolve('');
}
