import { createCommand } from '~/command.js';
import { runCli } from '~/index.js';
import { debugConsole } from '~/log.js';

const command = createCommand({
  name: 'ssc',
  description: 'syscript compiler',
  args: [
    { name: 'arg1', type: 'string', description: 'the first argument' },
    { name: 'arg2', type: 'string', description: 'the second argument' },
  ],
  options: [
    { name: 'option1', type: 'boolean', description: 'the first option' },
    { name: 'option2', type: 'boolean', description: 'the second option' },
  ],
  run: (args, options) => {
    const testExitCode = 3;
    debugConsole.log({ args, options, testExitCode });
    return testExitCode;
  },
});

await runCli(command, { completion: true });
