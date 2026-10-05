import { createCommand, runCli } from '~/index.js';

const command = createCommand({
  name: 'ssc-cli',
  description: 'Syscript CLI completion example',
  args: [{ name: 'entry', type: 'string', description: 'Path label to print', complete: 'file' }],
  options: [
    {
      name: 'profile',
      type: 'string',
      description: 'Profile label to print',
      complete: ['dev', 'release'],
    },
    {
      name: 'dry',
      type: 'boolean',
      alias: ['d', 'dry'],
      negative: true,
      description: 'Dry flag to print',
    },
  ],
  run: ([entry], { profile, dry }) => {
    console.log({ entry, profile, dry });
    return 0;
  },
});

await runCli(command, { completion: true, version: '0.0.0' });
