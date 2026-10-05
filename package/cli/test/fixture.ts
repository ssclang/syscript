import { createCommand, runCli } from '~/index.js';

const command = createCommand({
  name: 'ssc-cli',
  description: 'Syscript CLI completion example',
  args: [{ name: 'entry', type: 'string', complete: 'file' }],
  options: [
    { name: 'profile', type: 'string', complete: ['dev', 'release'] },
    { name: 'dry', type: 'boolean', alias: ['d', 'dry'], negative: true },
  ],
  run: ([entry], { profile, dry }) => {
    console.log({ entry, profile, dry });
    return 0;
  },
});

await runCli(command, { completion: true, version: '0.0.0' });
