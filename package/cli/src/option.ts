import { MaybePromise } from '@syscript/share/type';
import z from 'zod';

export type InputCliOption = z.input<typeof ZCliOption>;

export type OutputCliOption = z.output<typeof ZCliOption>;

export type LintKey = (typeof ZlintKeyEnum.options)[number];

export const ZlintKeyEnum = z.enum(['unnecessary-option']);

export const ZCompletionShell = z.enum(['zsh', 'bash', 'fish', 'powershell']);

export const ZCliOption = z.strictObject({
  /**
   * enable the built-in `complete` command.
   * @default true
   */
  completion: z.boolean().default(true),
  /**
   * whether to set the exit code
   * @default true
   */
  setExitCode: z.boolean().default(true),
  /**
   * handle error before default handling, return exit code or throw `CliExitError` or rethrow error
   *
   * The error is usually a `CliExitError` from the parser or an `Error` from `run`, but can be any thrown value.
   */
  handleError: z.function({ input: [z.unknown()], output: z.number().optional() }).optional(),
  /**
   * version printed by `--version`, which is not available without it
   */
  version: z
    .union([
      z.string(),
      z.custom<() => MaybePromise<string>>((value) => typeof value === 'function'),
    ])
    .optional(),
  /**
   * arguments to parse
   * @default process.argv
   */
  argv: z.string().array().default(process.argv),
  /**
   * configure debug option
   * @default false
   */
  debug: z.boolean().default(false),
  /**
   * configure lint option
   * @default false
   */
  lint: z
    .union([
      z.boolean(),
      z.strictObject({
        enable: ZlintKeyEnum.array().default(ZlintKeyEnum.options),
        disable: ZlintKeyEnum.array().default([]),
      }),
    ])
    .default(false)
    .transform((v) => {
      if (v === true) {
        return {
          enable: ZlintKeyEnum.options,
          disable: [],
        };
      }

      if (v === false) {
        return {
          enable: [],
          disable: ZlintKeyEnum.options,
        };
      }

      return v;
    }),
});
