import { spawnSync } from 'node:child_process';
import { describe, expect, test, vi } from 'vitest';
import { Completion } from '~/completion.js';
import { formatCompletion, printCompletionScript } from '~/tab.js';

describe('tab adapter', () => {
  test('writes tab protocol rows and file directives', () => {
    const result: Completion = {
      candidates: [{ value: 'dev', description: 'Development\tmode' }],
      files: 'none',
    };
    expect(formatCompletion(result)).toBe('dev\tDevelopment mode\n:4\n');
    expect(formatCompletion({ candidates: [], files: 'file' })).toBe(':0\n');
    expect(formatCompletion({ candidates: [], files: 'directory' })).toBe(':16\n');
  });

  test('preserves short attached option prefix and rejects control characters', () => {
    expect(formatCompletion({ candidates: [{ value: 'dev' }], files: 'none', prefix: '-p' })).toBe(
      '-pdev\t\n:4\n',
    );
    expect(
      formatCompletion({ candidates: [{ value: 'dev' }], files: 'none', prefix: '--profile=' }),
    ).toBe('dev\t\n:4\n');
    expect(() => formatCompletion({ candidates: [{ value: 'x\n:0' }], files: 'none' })).toThrow();
  });

  test.each(['zsh', 'bash', 'fish', 'powershell'])('uses tab to print %s script', (shell) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      printCompletionScript('ssc-cli', shell);
      expect(log).toHaveBeenCalledOnce();
      expect(log.mock.calls[0]?.[0]).toContain('complete');
    } finally {
      log.mockRestore();
    }
  });

  test.each(['zsh', 'bash'].filter((shell) => !spawnSync(shell, ['-c', ':']).error))(
    'generated %s script passes shell syntax check',
    (shell) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      let script: string;
      try {
        printCompletionScript('ssc-cli', shell);
        script = String(log.mock.calls[0]?.[0] ?? '');
      } finally {
        log.mockRestore();
      }
      const check = spawnSync(shell, ['-n'], { input: script, encoding: 'utf8' });
      expect(check.status).toBe(0);
    },
  );

  test.skipIf(Boolean(spawnSync('bash', ['-c', ':']).error))(
    'Bash callback reaches the real CLI fixture',
    () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      let script: string;
      try {
        printCompletionScript('ssc-cli', 'bash');
        script = String(log.mock.calls[0]?.[0] ?? '');
      } finally {
        log.mockRestore();
      }

      const smoke = [
        script,
        'ssc-cli() { NODE_ENV=test node --import tsx test/fixture.ts "$@"; }',
        '_get_comp_words_by_ref() { words=(ssc-cli --pro); cur=--pro; prev=ssc-cli; cword=1; }',
        'compopt() { :; }',
        'completion_spec=$(complete -p ssc-cli) || exit 1',
        '[[ $completion_spec =~ -F[[:space:]]+([^[:space:]]+) ]] || exit 1',
        'callback=${BASH_REMATCH[1]}',
        'declare -F "$callback" >/dev/null || exit 1',
        '"$callback" || exit 1',
        'printf "%s\\n" "${COMPREPLY[@]}"',
      ].join('\n');
      const result = spawnSync('bash', ['--noprofile', '--norc', '-c', smoke], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('--profile\n');
    },
  );

  test('rejects shell injection in the program name', () => {
    expect(() => printCompletionScript('ssc;exit', 'zsh')).toThrow();
    expect(() => printCompletionScript('ssc', 'unknown')).toThrow();
  });
});
