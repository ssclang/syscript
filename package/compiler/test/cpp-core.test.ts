import fs from 'fs/promises';
import { expect, test } from 'vitest';
import { cppCoreFunctionNames } from '~/cpp/core.js';
import { PathResolver } from '~/util/path-resolver.js';

function isExported(code: string, name: string) {
  const pattern = new RegExp(`\\b${name}\\s*\\(`, 'g');

  return code.matchAll(pattern).some((match) => {
    const before = code.slice(0, match.index);
    const exportIndex = before.lastIndexOf('export');
    const boundaryIndex = Math.max(
      before.lastIndexOf(';'),
      before.lastIndexOf('{'),
      before.lastIndexOf('}'),
    );

    return exportIndex > boundaryIndex;
  });
}

test('core function names are exported from the prelude', async () => {
  const code = await fs.readFile(PathResolver.preludeCppmPath(), 'utf8');
  const missings = cppCoreFunctionNames.filter((name) => !isExported(code, name));

  expect(missings).toEqual([]);
});
