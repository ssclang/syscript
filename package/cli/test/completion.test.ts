import { describe, expect, test, vi } from 'vitest';
import { CommandNode, createCommand, parseCli } from '~/command.js';
import { getCompletion } from '~/completion.js';
import { runCli } from '~/index.js';

const run = vi.fn(() => 0);

function command() {
  return createCommand({
    name: 'ssc-cli',
    args: [{ name: 'entry', type: 'string', complete: 'file' }],
    options: [
      { name: 'profile', type: 'string', alias: ['p', 'profile'], complete: ['dev', 'release'] },
      { name: 'dry', type: 'boolean', alias: ['d', 'dry'], negative: true },
      { name: 'include', type: 'string', alias: ['i', 'include'], allowMultiple: true },
    ],
    subcommands: [
      { name: 'build', alias: ['build', 'b'], run },
      { name: 'test', run },
    ],
    run,
  });
}

function values(words: readonly string[], options?: { completion?: boolean; version?: boolean }) {
  return getCompletion(command(), words, options).candidates.map(({ value }) => value);
}

describe('semantic completion', () => {
  test('uses the same alias and negative flag definitions as the parser', () => {
    expect(values(['--'])).toEqual(
      expect.arrayContaining(['--profile', '--dry', '--no-dry', '--help']),
    );
    expect(values(['-'])).toEqual(expect.arrayContaining(['-p', '-d', '-i']));
    expect(values(['--profile=de'])).toEqual(['dev']);
    expect(getCompletion(command(), ['--profile=de']).prefix).toBe('--profile=');
    expect(values(['-pde'])).toEqual(['dev']);
    expect(values(['-dpi'])).toEqual([]);
  });

  test('does not repeat a nonrepeatable option under another alias', () => {
    expect(values(['-p', 'dev', '--'])).not.toContain('--profile');
    expect(values(['--no-dry', '--'])).not.toContain('--dry');
    expect(values(['--no-dry', '--'])).not.toContain('--no-dry');
    expect(values(['--include', 'a', '--'])).toContain('--include');
  });

  test('rejects a duplicate in the current short cluster while allowing repeatable flags', async () => {
    expect(values(['-ddpde'])).toEqual([]);
    await expect(parseCli(command(), ['node', 'ssc-cli', 'entry.ts', '-ddpdev'])).rejects.toThrow(
      'duplicate option: -d',
    );

    const root = createCommand({
      name: 'app',
      options: [
        { name: 'repeat', type: 'boolean', alias: ['r'], allowMultiple: true },
        { name: 'profile', type: 'string', alias: ['p'], complete: ['dev'] },
      ],
      run,
    });
    expect(getCompletion(root, ['-rrpde']).candidates.map(({ value }) => value)).toEqual(['dev']);
  });

  test('keeps positional and nested command context', () => {
    expect(getCompletion(command(), ['']).files).toBe('file');
    expect(values(['entry.ts', ''])).toEqual(['build', 'b', 'test']);
    expect(values(['entry.ts', 'b', '--'])).toEqual(['--help']);
    expect(values(['entry.ts', 'build', '--profile', ''])).toEqual([]);
    expect(values(['entry.ts', 'unknown', ''])).toEqual([]);
  });

  test('requires an initial variadic value before a subcommand', () => {
    const root = createCommand({
      name: 'app',
      args: [{ name: 'files', type: 'string', allowMultiple: true, complete: ['alpha', 'build'] }],
      subcommands: [{ name: 'build', run }],
      run,
    });
    expect(getCompletion(root, ['']).candidates.map(({ value }) => value)).toEqual(['alpha']);
    expect(getCompletion(root, ['alpha', '']).candidates.map(({ value }) => value)).toEqual([
      'alpha',
      'build',
    ]);
  });

  test('keeps fixed-argument choices that share a later subcommand name', () => {
    const root = createCommand({
      name: 'app',
      args: [
        { name: 'first', type: 'string', complete: ['build', 'safe'] },
        { name: 'rest', type: 'string', allowMultiple: true, complete: ['build', 'tail'] },
      ],
      subcommands: [{ name: 'build', run }],
      run,
    });

    expect(getCompletion(root, ['']).candidates.map(({ value }) => value)).toEqual([
      'build',
      'safe',
    ]);
    expect(getCompletion(root, ['safe', '']).candidates.map(({ value }) => value)).toEqual([
      'tail',
    ]);
    expect(getCompletion(root, ['safe', 'tail', '']).candidates.map(({ value }) => value)).toEqual([
      'tail',
      'build',
    ]);
  });

  test('follows the parser when a parent positional value precedes a child', async () => {
    const root = createCommand({
      name: 'app',
      args: [{ name: 'number', type: 'number' }],
      subcommands: [{ name: 'build', options: [{ name: 'dry', type: 'boolean' }], run }],
      run,
    });

    expect(
      getCompletion(root, ['invalid-number', 'build', '--']).candidates.map(({ value }) => value),
    ).toEqual(['--dry', '--help']);
    await expect(parseCli(root, ['node', 'app', 'invalid-number', 'build'])).resolves.toBe(0);
  });

  test('recognizes built-ins only when enabled', () => {
    expect(values(['--'], { version: true })).toContain('--version');
    expect(values(['--'])).not.toContain('--version');
    expect(values([''], { completion: true })).toContain('complete');
    expect(values(['complete', ''])).toEqual(['build', 'b', 'test']);
    expect(values(['complete', ''], { completion: true })).toEqual([
      'zsh',
      'bash',
      'fish',
      'powershell',
    ]);
    expect(values(['complete', 'zsh', '--g'], { completion: true })).toEqual(['--grouped']);
    expect(values(['complete', 'bash', '--g'], { completion: true })).toEqual([]);
  });

  test('does not execute handlers while asking for candidates', () => {
    run.mockClear();
    getCompletion(command(), ['entry.ts', '--']);
    expect(run).not.toHaveBeenCalled();
  });

  test('rejects malformed completed input quietly', () => {
    expect(values(['--profile', '--dry', ''])).toEqual([]);
    expect(values(['--', ''])).toEqual([]);
    expect(values(['--dry', '--no-dry', ''])).toEqual([]);
  });

  test('does not enter a subcommand before required options', () => {
    const root: CommandNode = {
      name: 'app',
      options: [{ name: 'required', type: 'boolean', required: true }],
      subcommands: [{ name: 'build', run }],
      run,
    };
    expect(getCompletion(root, ['build', '']).candidates).toEqual([]);
    expect(
      getCompletion(root, ['--required', 'build', '--']).candidates.map(({ value }) => value),
    ).toEqual(['--help']);
  });
});

describe('runCli completion dispatch', () => {
  test('does not run the command for a completion request', async () => {
    run.mockClear();
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await runCli(command(), {
        argv: ['node', 'ssc-cli', 'complete', '--', '--pro'],
        completion: true,
        setExitCode: false,
      });
      expect(code).toBe(0);
      expect(output).toHaveBeenCalledWith('--profile\t\n:4\n');
      expect(run).not.toHaveBeenCalled();
    } finally {
      output.mockRestore();
    }
  });
});
