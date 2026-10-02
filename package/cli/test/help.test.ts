import { describe, expect, test } from 'vitest';
import { createCommand } from '~/command.js';
import { formatHelp } from '~/help.js';

function lines(...values: string[]) {
  return `${values.join('\n')}\n`;
}

const run = () => 0;

describe('formatHelp', () => {
  test('formats command with commands, arguments and options', () => {
    const command = createCommand({
      name: 'ssc',
      description: 'syscript compiler',
      args: [
        { name: 'src', type: 'string', description: 'Source file' },
        { name: 'files', type: 'string', allowMultiple: true, description: 'Files to include' },
      ],
      options: [
        {
          name: 'out',
          type: 'string',
          alias: ['o', 'out', 'output'],
          description: 'Output directory',
        },
        {
          name: 'port',
          type: 'number',
          alias: ['p', 'port'],
          defaultValue: 3000,
          description: 'Port number',
        },
        {
          name: 'verbose',
          type: 'boolean',
          alias: ['v', 'verbose'],
          description: 'Verbose output',
        },
        {
          name: 'color',
          type: 'boolean',
          alias: ['c', 'color'],
          negative: true,
          description: 'Use color',
        },
        { name: 'watch', type: 'boolean', negative: 'once', description: 'Watch files' },
      ],
      subcommands: [
        createCommand({ name: 'build', alias: ['build', 'b'], description: 'Build project', run }),
        createCommand({ name: 'test', description: 'Run tests', run }),
      ],
      run,
    });

    expect(formatHelp([command])).toBe(
      lines(
        'syscript compiler',
        '',
        'Usage: ssc [OPTIONS] <SRC> <FILES>... [COMMAND]',
        '',
        'Commands:',
        '  build, b  Build project',
        '  test      Run tests',
        '',
        'Arguments:',
        '  <SRC>       Source file',
        '  <FILES>...  Files to include',
        '',
        'Options:',
        '  -o, --out, --output <OUT>                      Output directory',
        '  -p, --port <PORT>                              Port number [default: 3000]',
        '  -v, --verbose                                  Verbose output',
        '  true: -c, --color | false: --no-c, --no-color  Use color',
        '  true: --watch | false: --once                  Watch files',
        '  --help                                         Print help',
      ),
    );
  });

  test('formats command without definitions', () => {
    const command = createCommand({ name: 'ssc', run });

    expect(formatHelp([command])).toBe(
      lines('Usage: ssc [OPTIONS]', '', 'Options:', '  --help  Print help'),
    );
  });

  test('formats subcommand with command path', () => {
    const build = createCommand({
      name: 'build',
      description: 'Build project',
      args: [{ name: 'entry', type: 'string' }],
      options: [{ name: 'outDir', type: 'string', alias: ['out-dir'] }],
      run,
    });
    const command = createCommand({ name: 'ssc', subcommands: [build], run });

    expect(formatHelp([command, build])).toBe(
      lines(
        'Build project',
        '',
        'Usage: ssc build [OPTIONS] <ENTRY>',
        '',
        'Arguments:',
        '  <ENTRY>',
        '',
        'Options:',
        '  --out-dir <OUT_DIR>',
        '  --help               Print help',
      ),
    );
  });

  test('formats required options and default values', () => {
    const command = createCommand({
      name: 'ssc',
      options: [
        { name: 'name', type: 'string', required: true },
        { name: 'push', type: 'boolean', negative: true, required: true },
        { name: 'level', type: 'number', allowMultiple: true, defaultValue: [1, 2] },
        { name: 'cache', type: 'boolean', defaultValue: false },
      ],
      run,
    });

    expect(formatHelp([command])).toBe(
      lines(
        'Usage: ssc [OPTIONS] --name <NAME> --push',
        '',
        'Options:',
        '  --name <NAME>',
        '  true: --push | false: --no-push',
        '  --level <LEVEL>                  [default: 1 2]',
        '  --cache                          [default: false]',
        '  --help                           Print help',
      ),
    );
  });

  test('formats version option when version is given', () => {
    const command = createCommand({ name: 'ssc', run });

    expect(formatHelp([command], { version: true })).toBe(
      lines(
        'Usage: ssc [OPTIONS]',
        '',
        'Options:',
        '  --help     Print help',
        '  --version  Print version',
      ),
    );
  });
});
