import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
import { CommandNode, createCommand, parseCli, ParseCliOption } from '~/command.js';
import { CliExitError } from '~/error.js';
import { formatHelp } from '~/help.js';

function argv(...args: string[]) {
  return ['node', 'ssc', ...args];
}

function createTestCommand() {
  const calls: { args: unknown; options: Record<string, unknown> }[] = [];
  const command = {
    name: 'ssc',
    args: [
      { name: 'arg1', type: 'string' },
      { name: 'arg2', type: 'string' },
    ],
    options: [
      { name: 'option1', type: 'boolean', alias: ['option1', 'o1', 'x'], required: true },
      { name: 'option2', type: 'boolean', alias: ['option2', 'y', 'Y'], required: true },
    ],
    run: (args, options) => {
      calls.push({ args, options });
      return 0;
    },
  } as const satisfies CommandNode;

  return { command, calls } as const;
}

function createSubcommandTestCommand() {
  const calls: { command: string; args: unknown; options: Record<string, unknown> }[] = [];
  const command = {
    name: 'ssc',
    run: (args, options) => {
      calls.push({ command: 'ssc', args, options });
      return 0;
    },
    subcommands: [
      {
        name: 'build',
        args: [{ name: 'file', type: 'string' }],
        options: [{ name: 'watch', type: 'boolean', required: true }],
        run: (args, options) => {
          calls.push({ command: 'build', args, options });
          return 0;
        },
      },
      {
        name: 'test',
        run: (args, options) => {
          calls.push({ command: 'test', args, options });
          return 0;
        },
      },
    ],
  } as const satisfies CommandNode;

  return { command, calls } as const;
}

function createAliasTestCommand() {
  const calls: { args: unknown; options: Record<string, unknown> }[] = [];
  const command = {
    name: 'ssc',
    options: [{ name: 'outDir', type: 'boolean', alias: ['o', 'out-dir'] }],
    run: (args, options) => {
      calls.push({ args, options });
      return 0;
    },
  } as const satisfies CommandNode;

  return { command, calls } as const;
}

function createOptionTestCommand(options: NonNullable<CommandNode['options']>) {
  const calls: { args: unknown; options: Record<string, unknown> }[] = [];
  const command = {
    name: 'ssc',
    options,
    run: (args, options) => {
      calls.push({ args, options });
      return 0;
    },
  } as const satisfies CommandNode;

  return { command, calls } as const;
}

function createBooleanTestCommand() {
  return createOptionTestCommand([
    { name: 'verbose', type: 'boolean' },
    { name: 'cache', type: 'boolean', negative: true, defaultValue: true },
    { name: 'color', type: 'boolean', alias: ['color', 'c'], negative: true },
    { name: 'watch', type: 'boolean', negative: 'once' },
    { name: 'minify', type: 'boolean', negative: true, allowBoolish: true },
  ]);
}

function createCommandAliasTestCommand(subcommands?: NonNullable<CommandNode['subcommands']>) {
  const calls: string[] = [];
  const createSubcommand = (name: string, alias?: CommandNode['alias']) =>
    ({
      name,
      alias,
      run: () => {
        calls.push(name);
        return 0;
      },
    }) satisfies CommandNode;
  const command = {
    name: 'ssc',
    run: () => 0,
    subcommands: subcommands || [
      createSubcommand('build', ['b']),
      createSubcommand('test', ['test', 't']),
      createSubcommand('lint'),
    ],
  } as const satisfies CommandNode;

  return { command, calls, createSubcommand } as const;
}

function createValueTestCommand() {
  return createOptionTestCommand([
    { name: 'out', type: 'string', alias: ['o', 'out'] },
    { name: 'port', type: 'number', alias: ['p', 'port'], defaultValue: 3000 },
    { name: 'x', type: 'boolean' },
  ]);
}

function createMultipleTestCommand() {
  return createOptionTestCommand([
    { name: 'include', type: 'string', alias: ['i', 'include'], allowMultiple: true },
    {
      name: 'level',
      type: 'number',
      alias: ['l', 'level'],
      allowMultiple: true,
      defaultValue: [1],
    },
    { name: 'out', type: 'string', alias: ['o', 'out'] },
  ]);
}

function createArgumentTestCommand(args: NonNullable<CommandNode['args']>) {
  const calls: unknown[] = [];
  const command = {
    name: 'ssc',
    args,
    options: [{ name: 'verbose', type: 'boolean', alias: ['v'] }],
    run: (args) => {
      calls.push(args);
      return 0;
    },
    subcommands: [{ name: 'build', run: () => 0 }],
  } as const satisfies CommandNode;

  return { command, calls } as const;
}

async function expectExit(command: CommandNode, args: string[], exitCode: number, message: string) {
  const result = parseCli(command, argv(...args));

  await expect(result).rejects.toBeInstanceOf(CliExitError);
  await expect(result).rejects.toMatchObject({ exitCode, message });
}

async function expectDefinitionError(result: Promise<unknown>, message: string) {
  await expect(result).rejects.toBeInstanceOf(CliExitError);
  await expect(result).rejects.toMatchObject({ type: 'definition', exitCode: 1 });
  await expect(result).rejects.toThrow(message);
}

describe('parseCli', () => {
  test.each([
    [['a', 'b', '--option1', '--option2']],
    [['a', '--option1', 'b', '--option2']],
    [['--option1', 'a', 'b', '--option2']],
    [['--option1', '--option2', 'a', 'b']],
    [['--option1', 'a', '--option2', 'b']],
    [['a', 'b', '--o1', '--option2']],
  ])('parses args and options in any order: %j', async (input) => {
    const { command, calls } = createTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toEqual([
      {
        args: [
          { name: 'arg1', value: 'a' },
          { name: 'arg2', value: 'b' },
        ],
        options: { option1: true, option2: true },
      },
    ]);
  });

  test.each([
    [['a', 'b', '-x', '--option2']],
    [['a', 'b', '-x', '-Y']],
    [['a', 'b', '-xy']],
    [['a', 'b', '-yx']],
    [['-xy', 'a', 'b']],
  ])('parses short options: %j', async (input) => {
    const { command, calls } = createTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toEqual([
      {
        args: [
          { name: 'arg1', value: 'a' },
          { name: 'arg2', value: 'b' },
        ],
        options: { option1: true, option2: true },
      },
    ]);
  });

  test.each([
    [['a', 'b', '--x', '--option2'], 'unknown option: --x'],
    [['a', 'b', '-option1'], 'unknown option: -o'],
    [['a', 'b', '-xz'], 'unknown option: -z'],
    [['a', 'b', '-xx'], 'duplicate option: -x'],
    [['a', 'b', '-yY', '-x'], 'duplicate option: -Y'],
    [['a', 'b', '-x', '--option1', '-y'], 'duplicate option: --option1'],
  ] as const)('rejects short option input %j', async (input, message) => {
    const { command, calls } = createTestCommand();

    await expectExit(command, [...input], 2, message);
    expect(calls).toEqual([]);
  });

  test.each([[['-o']], [['--out-dir']]])('uses alias as input key: %j', async (input) => {
    const { command, calls } = createAliasTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toEqual([{ args: [], options: { outDir: true } }]);
  });

  test('does not use name as input key when alias is defined', async () => {
    const { command, calls } = createAliasTestCommand();

    await expectExit(command, ['--outDir'], 2, 'unknown option: --outDir');
    expect(calls).toEqual([]);
  });

  test.each([
    [[], 2, 'missing required arguments: <ARG1>, <ARG2>'],
    [['a'], 2, 'missing required arguments: <ARG2>'],
    [['a', 'b'], 2, 'missing required options: --option1, --option2'],
    [['a', '--'], 1, 'not implemented: double dash'],
    [['a', 'b', '--option1', '--zzz'], 2, 'unknown option: --zzz'],
    [['a', 'b', '--option1', '--option1'], 2, 'duplicate option: --option1'],
    [['a', 'b', '--option1', '--o1'], 2, 'duplicate option: --o1'],
    [['a', 'b', '--option1', '--option2', 'extra'], 2, 'unexpected argument: extra'],
    [['a', 'b', '--option1=v', '--option2'], 2, 'option does not take a value: --option1=v'],
  ] as const)('rejects %j', async (input, exitCode, message) => {
    const { command, calls } = createTestCommand();

    await expectExit(command, [...input], exitCode, message);
    expect(calls).toEqual([]);
  });

  test.each([
    [
      ['build', 'a.ts', '--watch'],
      { command: 'build', args: [{ name: 'file', value: 'a.ts' }], options: { watch: true } },
    ],
    [
      ['build', '--watch', 'a.ts'],
      { command: 'build', args: [{ name: 'file', value: 'a.ts' }], options: { watch: true } },
    ],
    [['test'], { command: 'test', args: [], options: {} }],
  ] as const)('enters subcommand by name: %j', async (input, expected) => {
    const { command, calls } = createSubcommandTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toEqual([expected]);
  });

  test.each([
    [['zzz'], 2, 'unknown command: zzz'],
    [['build'], 2, 'missing required arguments: <FILE>'],
    [['build', '--watch'], 2, 'missing required arguments: <FILE>'],
    [['build', 'a.ts'], 2, 'missing required options: --watch'],
    [['build', 'a.ts', '--watch', 'extra'], 2, 'unexpected argument: extra'],
  ] as const)('rejects subcommand input %j', async (input, exitCode, message) => {
    const { command, calls } = createSubcommandTestCommand();

    await expectExit(command, [...input], exitCode, message);
    expect(calls).toEqual([]);
  });

  test.each([
    [[], {}],
    [['--verbose'], { verbose: true }],
    [['--cache'], { cache: true }],
    [['--no-cache'], { cache: false }],
    [['--color'], { color: true }],
    [['-c'], { color: true }],
    [['--no-color'], { color: false }],
    [['--no-c'], { color: false }],
    [['--watch'], { watch: true }],
    [['--once'], { watch: false }],
    [['--minify=true'], { minify: true }],
    [['--minify=YES'], { minify: true }],
    [['--minify=on'], { minify: true }],
    [['--minify=0'], { minify: false }],
    [['--minify=disabled'], { minify: false }],
    [['--no-minify=false'], { minify: true }],
    [['--no-minify=1'], { minify: false }],
    [['-c', '--verbose', '--no-cache'], { color: true, verbose: true, cache: false }],
  ] as const)('parses boolean options: %j', async (input, expected) => {
    const { command, calls } = createBooleanTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([
      {
        args: [],
        options: {
          verbose: undefined,
          cache: true,
          color: undefined,
          watch: undefined,
          minify: undefined,
          ...expected,
        },
      },
    ]);
  });

  test.each([
    [['--no-verbose'], 'unknown option: --no-verbose'],
    [['--no-watch'], 'unknown option: --no-watch'],
    [['--color', '--no-color'], 'duplicate option: --no-color'],
    [['--no-c', '-c'], 'duplicate option: -c'],
    [['--cache', '--no-cache'], 'duplicate option: --no-cache'],
    [['--watch', '--once'], 'duplicate option: --once'],
    [['--verbose=true'], 'option does not take a value: --verbose=true'],
    [['--no-cache=true'], 'option does not take a value: --no-cache=true'],
    [['--minify=maybe'], 'invalid boolean value: --minify=maybe'],
    [['--minify='], 'invalid boolean value: --minify='],
  ] as const)('rejects boolean option input %j', async (input, message) => {
    const { command, calls } = createBooleanTestCommand();

    await expectExit(command, [...input], 2, message);
    expect(calls).toEqual([]);
  });

  test.each([
    [['--push'], { push: true }],
    [['--no-push'], { push: false }],
  ] as const)('parses required boolean option: %j', async (input, options) => {
    const { command, calls } = createOptionTestCommand([
      { name: 'push', type: 'boolean', negative: true, required: true },
    ]);

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([{ args: [], options }]);
  });

  test('rejects missing required boolean option', async () => {
    const { command, calls } = createOptionTestCommand([
      { name: 'push', type: 'boolean', negative: true, required: true },
      { name: 'verbose', type: 'boolean' },
    ]);

    await expectExit(command, ['--verbose'], 2, 'missing required options: --push');
    expect(calls).toEqual([]);
  });

  test.each([
    [[], { push: false }],
    [['--push'], { push: true }],
  ] as const)('uses default value of required boolean option: %j', async (input, options) => {
    const { command, calls } = createOptionTestCommand([
      { name: 'push', type: 'boolean', required: true, defaultValue: false },
    ]);

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([{ args: [], options }]);
  });

  test('does not require optional boolean option', async () => {
    const { command, calls } = createOptionTestCommand([
      { name: 'push', type: 'boolean', negative: true, required: true },
      { name: 'verbose', type: 'boolean' },
    ]);

    await expect(parseCli(command, argv('--push'))).resolves.toBe(0);
    expect(calls).toStrictEqual([{ args: [], options: { push: true, verbose: undefined } }]);
  });

  test.each([
    [
      'negative option name must have at least two letters: N',
      [{ name: 'watch', type: 'boolean', negative: 'N' }],
    ],
    [
      'duplicate option name: no-cache',
      [
        { name: 'cache', type: 'boolean', negative: true },
        { name: 'no-cache', type: 'boolean' },
      ],
    ],
    [
      'duplicate option name: verbose',
      [
        { name: 'watch', type: 'boolean', negative: 'verbose' },
        { name: 'verbose', type: 'boolean' },
      ],
    ],
  ] as const)('rejects invalid boolean option definition: %s', async (message, options) => {
    const { command, calls } = createOptionTestCommand(options);

    await expectDefinitionError(parseCli(command, argv()), message);
    expect(calls).toEqual([]);
  });

  test.each([
    [['b'], 'build'],
    [['test'], 'test'],
    [['t'], 'test'],
    [['lint'], 'lint'],
  ] as const)('enters subcommand by alias: %j', async (input, expected) => {
    const { command, calls } = createCommandAliasTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toEqual([expected]);
  });

  test('does not use command name when alias is defined', async () => {
    const { command, calls } = createCommandAliasTestCommand();

    await expectExit(command, ['build'], 2, 'unknown command: build');
    expect(calls).toEqual([]);
  });

  test.each([
    [
      'duplicate command name: b',
      [
        ['build', ['b']],
        ['bench', ['b']],
      ],
    ],
    ['duplicate command name: b', [['b'], ['build', ['b']]]],
    ['empty command alias: build', [['build', []]]],
  ] as const)('rejects invalid command definition: %s', async (message, definitions) => {
    const { createSubcommand } = createCommandAliasTestCommand();
    const subcommands = definitions.map(([name, alias]) =>
      createSubcommand(name, alias as CommandNode['alias']),
    );
    const { command, calls } = createCommandAliasTestCommand(
      subcommands as unknown as NonNullable<CommandNode['subcommands']>,
    );

    await expectDefinitionError(parseCli(command, argv()), message);
    expect(calls).toEqual([]);
  });

  test.each([
    [
      'duplicate argument name: file',
      [
        { name: 'file', type: 'string' },
        { name: 'file', type: 'string' },
      ],
    ],
    [
      'duplicate argument name: dir, file',
      [
        { name: 'file', type: 'string' },
        { name: 'dir', type: 'string' },
        { name: 'file', type: 'string' },
        { name: 'dir', type: 'string' },
        { name: 'file', type: 'string' },
      ],
    ],
  ] as const)('rejects duplicate argument name: %s', async (message, args) => {
    const command = {
      name: 'ssc',
      args,
      run: () => 0,
    } as const satisfies CommandNode;

    await expectDefinitionError(parseCli(command, argv()), message);
  });

  test.each([
    [
      'duplicate option name: x',
      {
        name: 'build',
        options: [
          { name: 'x', type: 'boolean' },
          { name: 'y', type: 'boolean', alias: ['x'] },
        ],
        run: () => 0,
      },
    ],
    [
      'duplicate command name: a',
      {
        name: 'build',
        run: () => 0,
        subcommands: [
          { name: 'a', run: () => 0 },
          { name: 'a', run: () => 0 },
        ],
      },
    ],
    [
      'empty command alias: deep',
      {
        name: 'build',
        run: () => 0,
        subcommands: [{ name: 'deep', alias: [], run: () => 0 }],
      },
    ],
  ] as [string, unknown][])(
    'validates whole command tree before parsing: %s',
    async (message, subcommand) => {
      const calls: string[] = [];
      const command = {
        name: 'ssc',
        run: () => 0,
        subcommands: [
          {
            name: 'other',
            run: () => {
              calls.push('other');
              return 0;
            },
          },
          subcommand as CommandNode,
        ],
      } as const satisfies CommandNode;

      await expectDefinitionError(parseCli(command, argv()), message);
      await expectDefinitionError(parseCli(command, argv('other')), message);
      expect(calls).toEqual([]);
    },
  );

  test.each([
    [[], {}],
    [['--out=dist'], { out: 'dist' }],
    [['--out', 'dist'], { out: 'dist' }],
    [['-o', 'dist'], { out: 'dist' }],
    [['-odist'], { out: 'dist' }],
    [['-ox'], { out: 'x' }],
    [['-xo', 'dist'], { x: true, out: 'dist' }],
    [['-xodist'], { x: true, out: 'dist' }],
    [['--out='], { out: '' }],
    [['--out=a=b'], { out: 'a=b' }],
    [['--port=8080'], { port: 8080 }],
    [['--port', '8080'], { port: 8080 }],
    [['-p8080'], { port: 8080 }],
    [['--port=-1'], { port: -1 }],
    [['-p-1'], { port: -1 }],
    [['--port=0'], { port: 0 }],
    [['--port=9007199254740991'], { port: 9007199254740991 }],
    [['--port=-9007199254740991'], { port: -9007199254740991 }],
  ] as const)('parses value options: %j', async (input, expected) => {
    const { command, calls } = createValueTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([
      { args: [], options: { out: undefined, port: 3000, x: undefined, ...expected } },
    ]);
  });

  test.each([
    [['--out'], 'missing value: --out'],
    [['--out', '--port=1'], 'missing value: --out'],
    [['-o'], 'missing value: -o'],
    [['-xo'], 'missing value: -o'],
    [['--port=abc'], 'invalid number value: --port=abc'],
    [['--port', 'abc'], 'invalid number value: --port abc'],
    [['-pabc'], 'invalid number value: -pabc'],
    [['--port='], 'invalid number value: --port='],
    [['--port=Infinity'], 'invalid number value: --port=Infinity'],
    [['--port=1.5'], 'invalid number value: --port=1.5'],
    [['--port=0.1'], 'invalid number value: --port=0.1'],
    [['--port=9007199254740992'], 'invalid number value: --port=9007199254740992'],
    [['--port=9007199254740993'], 'invalid number value: --port=9007199254740993'],
    [
      ['--port=0.1000000000000000055511151231257827'],
      'invalid number value: --port=0.1000000000000000055511151231257827',
    ],
    [['--port=1.0'], 'invalid number value: --port=1.0'],
    [['--port=01'], 'invalid number value: --port=01'],
    [['--port=-0'], 'invalid number value: --port=-0'],
    [['--port=1e3'], 'invalid number value: --port=1e3'],
    [['--port= 1'], 'invalid number value: --port= 1'],
    [['--out', 'a', '--out', 'b'], 'duplicate option: --out'],
    [['--out=a', '-o', 'b'], 'duplicate option: -o'],
  ] as const)('rejects value option input %j', async (input, message) => {
    const { command, calls } = createValueTestCommand();

    await expectExit(command, [...input], 2, message);
    expect(calls).toEqual([]);
  });

  test.each([[['--out', 'dist', 'a.ts']], [['a.ts', '--out', 'dist']], [['a.ts', '--out=dist']]])(
    'does not count option value as argument: %j',
    async (input) => {
      const calls: { args: unknown; options: Record<string, unknown> }[] = [];
      const command = {
        name: 'ssc',
        args: [{ name: 'file', type: 'string' }],
        options: [{ name: 'out', type: 'string' }],
        run: (args, options) => {
          calls.push({ args, options });
          return 0;
        },
      } as const satisfies CommandNode;

      await expect(parseCli(command, argv(...input))).resolves.toBe(0);
      expect(calls).toStrictEqual([
        { args: [{ name: 'file', value: 'a.ts' }], options: { out: 'dist' } },
      ]);
    },
  );

  test('rejects missing required value option', async () => {
    const { command, calls } = createOptionTestCommand([
      { name: 'out', type: 'string', required: true },
    ]);

    await expectExit(command, [], 2, 'missing required options: --out <OUT>');
    expect(calls).toEqual([]);
  });

  test('uses default value of required value option', async () => {
    const { command, calls } = createOptionTestCommand([
      { name: 'port', type: 'number', required: true, defaultValue: 3000 },
    ]);

    await expect(parseCli(command, argv())).resolves.toBe(0);
    expect(calls).toStrictEqual([{ args: [], options: { port: 3000 } }]);
  });

  test.each([
    [[], {}],
    [['--include', 'a'], { include: ['a'] }],
    [['--include=a', '-i', 'b', '-ic'], { include: ['a', 'b', 'c'] }],
    [['-l2', '--level=3'], { level: [2, 3] }],
    [['--include', 'a', '--out', 'x', '--include', 'b'], { include: ['a', 'b'], out: 'x' }],
  ] as const)('parses multiple value options: %j', async (input, expected) => {
    const { command, calls } = createMultipleTestCommand();

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([
      { args: [], options: { include: [], level: [1], out: undefined, ...expected } },
    ]);
  });

  test.each([
    [['--out', 'a', '--out', 'b'], 'duplicate option: --out'],
    [['--include'], 'missing value: --include'],
    [['--level=abc'], 'invalid number value: --level=abc'],
  ] as const)('rejects multiple value option input %j', async (input, message) => {
    const { command, calls } = createMultipleTestCommand();

    await expectExit(command, [...input], 2, message);
    expect(calls).toEqual([]);
  });

  test('requires at least one value for required multiple option', async () => {
    const { command, calls } = createOptionTestCommand([
      { name: 'file', type: 'string', allowMultiple: true, required: true },
    ]);

    await expectExit(command, [], 2, 'missing required options: --file <FILE>');
    await expect(parseCli(command, argv('--file', 'a'))).resolves.toBe(0);
    expect(calls).toStrictEqual([{ args: [], options: { file: ['a'] } }]);
  });

  test.each([
    [[], { flag: [], cache: [true] }],
    [['--flag', '--flag'], { flag: [true, true], cache: [true] }],
    [['--flag', '--no-flag', '-f'], { flag: [true, false, true], cache: [true] }],
    [['--flag=off', '--no-flag=0'], { flag: [false, true], cache: [true] }],
    [['--no-cache', '--cache'], { flag: [], cache: [false, true] }],
  ] as const)('parses multiple boolean options: %j', async (input, options) => {
    const { command, calls } = createOptionTestCommand([
      {
        name: 'flag',
        type: 'boolean',
        alias: ['flag', 'f'],
        negative: true,
        allowBoolish: true,
        allowMultiple: true,
      },
      { name: 'cache', type: 'boolean', negative: true, allowMultiple: true, defaultValue: [true] },
    ]);

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([{ args: [], options }]);
  });

  test('infers option value types from definition', () => {
    createCommand({
      name: 'ssc',
      options: [
        { name: 'out', type: 'string' },
        { name: 'port', type: 'number', defaultValue: 3000 },
        { name: 'include', type: 'string', allowMultiple: true },
        { name: 'level', type: 'number', allowMultiple: true, defaultValue: [1] },
        { name: 'verbose', type: 'boolean', required: true },
        { name: 'color', type: 'boolean', negative: true },
        { name: 'cache', type: 'boolean', defaultValue: false },
      ],
      run: (_args, options) => {
        expectTypeOf(options).toEqualTypeOf<{
          out: string | undefined;
          port: number;
          include: readonly string[];
          level: readonly number[];
          verbose: boolean;
          color: boolean | undefined;
          cache: boolean;
        }>();
        return 0;
      },
    });
  });

  test('infers empty options without definition', () => {
    createCommand({
      name: 'ssc',
      run: (_args, _options) => {
        expectTypeOf<keyof typeof _options>().toEqualTypeOf<never>();
        return 0;
      },
    });
  });

  test.each([
    [
      ['a', 'b'],
      [
        { name: 'src', value: 'a' },
        { name: 'files', value: ['b'] },
      ],
    ],
    [
      ['a', 'b', 'c'],
      [
        { name: 'src', value: 'a' },
        { name: 'files', value: ['b', 'c'] },
      ],
    ],
    [
      ['a', 'b', '-v', 'c'],
      [
        { name: 'src', value: 'a' },
        { name: 'files', value: ['b', 'c'] },
      ],
    ],
  ] as const)('parses multiple argument: %j', async (input, expected) => {
    const { command, calls } = createArgumentTestCommand([
      { name: 'src', type: 'string' },
      { name: 'files', type: 'string', allowMultiple: true },
    ]);

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([expected]);
  });

  test('parses multiple number argument', async () => {
    const { command, calls } = createArgumentTestCommand([
      { name: 'levels', type: 'number', allowMultiple: true },
    ]);

    await expect(parseCli(command, argv('1', '2', '3'))).resolves.toBe(0);
    expect(calls).toStrictEqual([[{ name: 'levels', value: [1, 2, 3] }]]);
  });

  test.each([
    [[{ name: 'flag', type: 'boolean' }], ['true'], [{ name: 'flag', value: true }]],
    [[{ name: 'flag', type: 'boolean' }], ['false'], [{ name: 'flag', value: false }]],
    [
      [{ name: 'flag', type: 'boolean', allowBoolish: true }],
      ['YES'],
      [{ name: 'flag', value: true }],
    ],
    [
      [{ name: 'flag', type: 'boolean', allowBoolish: true }],
      ['off'],
      [{ name: 'flag', value: false }],
    ],
    [
      [{ name: 'flags', type: 'boolean', allowMultiple: true }],
      ['true', 'false'],
      [{ name: 'flags', value: [true, false] }],
    ],
  ] as const)('parses boolean argument: %j %j', async (args, input, expected) => {
    const { command, calls } = createArgumentTestCommand(args);

    await expect(parseCli(command, argv(...input))).resolves.toBe(0);
    expect(calls).toStrictEqual([expected]);
  });

  test.each([
    [[{ name: 'port', type: 'number' }], ['x'], 'invalid number value: x'],
    [[{ name: 'port', type: 'number' }], ['1.5'], 'invalid number value: 1.5'],
    [
      [{ name: 'levels', type: 'number', allowMultiple: true }],
      ['1', 'x'],
      'invalid number value: x',
    ],
    [[{ name: 'flag', type: 'boolean' }], ['yes'], 'invalid boolean value: yes'],
    [
      [{ name: 'flag', type: 'boolean', allowBoolish: true }],
      ['maybe'],
      'invalid boolean value: maybe',
    ],
    [[{ name: 'src', type: 'string' }], [], 'missing required arguments: <SRC>'],
    [
      [{ name: 'files', type: 'string', allowMultiple: true }],
      [],
      'missing required arguments: <FILES>...',
    ],
  ] as const)('rejects argument input: %j %j', async (args, input, message) => {
    const { command, calls } = createArgumentTestCommand(args);

    await expectExit(command, [...input], 2, message);
    expect(calls).toEqual([]);
  });

  test('stops multiple argument at subcommand', async () => {
    const { command, calls } = createArgumentTestCommand([
      { name: 'files', type: 'string', allowMultiple: true },
    ]);

    await expect(parseCli(command, argv('a', 'b', 'build'))).resolves.toBe(0);
    expect(calls).toEqual([]);
  });

  test('rejects argument after multiple argument', async () => {
    const { command, calls } = createArgumentTestCommand([
      { name: 'files', type: 'string', allowMultiple: true },
      { name: 'dst', type: 'string' },
    ]);

    await expectDefinitionError(parseCli(command, argv()), 'argument after multiple argument: dst');
    expect(calls).toEqual([]);
  });

  test('infers argument value types from definition', () => {
    createCommand({
      name: 'ssc',
      args: [
        { name: 'src', type: 'string' },
        { name: 'port', type: 'number' },
        { name: 'flag', type: 'boolean' },
        { name: 'files', type: 'string', allowMultiple: true },
      ],
      run: (args) => {
        expectTypeOf(args).toEqualTypeOf<
          readonly [
            { readonly name: 'src'; readonly value: string },
            { readonly name: 'port'; readonly value: number },
            { readonly name: 'flag'; readonly value: boolean },
            { readonly name: 'files'; readonly value: string[] },
          ]
        >();
        return 0;
      },
    });
  });

  describe('help and version', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function spyStdout() {
      return vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    }

    test.each([[['--help']], [['--help', 'build']]])('prints root help: %j', async (input) => {
      const write = spyStdout();
      const { command, calls } = createSubcommandTestCommand();

      await expect(parseCli(command, argv(...input))).resolves.toBe(0);
      expect(write).toHaveBeenCalledWith(formatHelp([command]));
      expect(calls).toEqual([]);
    });

    test.each([
      [['build', '--help']],
      [['build', '--help', 'a.ts']],
      [['build', 'a.ts', '--help']],
    ])('prints subcommand help before checking required values: %j', async (input) => {
      const write = spyStdout();
      const { command, calls } = createSubcommandTestCommand();
      const build = command.subcommands[0];

      await expect(parseCli(command, argv(...input))).resolves.toBe(0);
      expect(write).toHaveBeenCalledWith(formatHelp([command, build]));
      expect(calls).toEqual([]);
    });

    test('prints help with version option when version is given', async () => {
      const write = spyStdout();
      const { command } = createSubcommandTestCommand();

      await expect(parseCli(command, argv('--help'), { version: '1.2.3' })).resolves.toBe(0);
      expect(write).toHaveBeenCalledWith(formatHelp([command], { version: true }));
    });

    test('does not reserve short help name', async () => {
      const { command, calls } = createOptionTestCommand([
        { name: 'host', type: 'string', alias: ['h', 'host'] },
      ]);

      await expect(parseCli(command, argv('-h', 'localhost'))).resolves.toBe(0);
      expect(calls).toStrictEqual([{ args: [], options: { host: 'localhost' } }]);
    });

    test.each([[['-h']], [['--version']], [['-V']]])(
      'rejects help and version short names or version without option: %j',
      async (input) => {
        const { command, calls } = createSubcommandTestCommand();

        await expectExit(command, [...input], 2, `unknown option: ${input[0]}`);
        expect(calls).toEqual([]);
      },
    );

    const versions: [NonNullable<ParseCliOption['version']>, string[]][] = [
      ['1.2.3', ['--version']],
      [() => '1.2.3', ['--version']],
      [async () => Promise.resolve('1.2.3'), ['--version']],
      ['1.2.3', ['build', '--version']],
    ];

    test.each(versions)('prints version: %s %j', async (version, input) => {
      const write = spyStdout();
      const { command, calls } = createSubcommandTestCommand();

      await expect(parseCli(command, argv(...input), { version })).resolves.toBe(0);
      expect(write).toHaveBeenCalledWith('ssc 1.2.3\n');
      expect(calls).toEqual([]);
    });

    test.each([
      ['reserved option name: help', [{ name: 'help', type: 'boolean' }]],
      ['reserved option name: help', [{ name: 'watch', type: 'boolean', negative: 'help' }]],
      ['reserved option name: version', [{ name: 'version', type: 'string' }]],
      ['reserved option name: version', [{ name: 'v', type: 'boolean', alias: ['v', 'version'] }]],
    ] as const)('rejects reserved option name: %s', async (message, options) => {
      const { command, calls } = createOptionTestCommand(options);

      await expectDefinitionError(parseCli(command, argv()), message);
      expect(calls).toEqual([]);
    });
  });
});
