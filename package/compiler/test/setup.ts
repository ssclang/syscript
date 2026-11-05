import fs from 'fs/promises';
import path from 'path';

export default async function setup() {
  await fs.rm(path.join(import.meta.dirname, '.ssc', 'test'), { recursive: true, force: true });
}
