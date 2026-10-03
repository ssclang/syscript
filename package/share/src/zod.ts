import z, { ZodBigInt, ZodBigIntFormat, ZodCodec, ZodNumber, ZodString } from 'zod';

export type Z<T extends z.ZodType> = z.output<T>;

type ZNumberSchemaNumberParser = 'number' | 'int' | 'int32' | 'uint32';
type ZNumberSchemaBigIntParser = 'int64' | 'uint64';
type ZNumberSchemaAllParser = ZNumberSchemaNumberParser | ZNumberSchemaBigIntParser;
type ZNumberSchemaRange = 'default' | 'positive' | 'negative' | 'nonpositive' | 'nonnegative';
type ZNumberSchemaOption<T extends ZNumberSchemaAllParser = ZNumberSchemaAllParser> = {
  parser?: T;
  range?: ZNumberSchemaRange;
};

const zNumberSchemaDefaultParser = 'number' as const satisfies ZNumberSchemaAllParser;
const zNumberSchemaDefaultRange = 'default' as const satisfies ZNumberSchemaRange;

const maxNumber = {
  number: '9007199254740991',
  int: '9007199254740991',
  int32: '2147483647',
  uint32: '4294967295',
  int64: '9223372036854775807',
  uint64: '18446744073709551615',
} as const satisfies Record<ZNumberSchemaAllParser, string>;

export function zNumber<T extends ZNumberSchemaNumberParser>(
  option?: ZNumberSchemaOption<T>,
): ZodNumber;

export function zNumber<T extends ZNumberSchemaBigIntParser>(
  option?: ZNumberSchemaOption<T>,
): ZodCodec<ZodString, ZodBigInt>;

export function zNumber(option: ZNumberSchemaOption = {}) {
  const parser = option.parser || zNumberSchemaDefaultParser;
  const zParser = getZNumberParser(option);

  return parser === 'int64' || parser === 'uint64' ?
      withZBigIntCodec(zParser as ZodBigIntFormat)
    : zParser;
}

export function zNumberString<T extends ZNumberSchemaAllParser>(
  option: ZNumberSchemaOption<T> = {},
) {
  const { parser = zNumberSchemaDefaultParser } = option;

  return z
    .string()
    .nonempty()
    .regex(/^-?\d+(\.\d+)?$/)
    .refine(
      (value) => {
        try {
          const zParser = getZNumberParser(option);
          const data = parser === 'int64' || parser === 'uint64' ? BigInt(value) : Number(value);
          const result = zParser.safeParse(data);

          return result.success && result.data.toString() === value;
        } catch {
          return false;
        }
      },
      { error: `parse failed: ${parser}` },
    )
    .meta({ example: maxNumber[parser] });
}

function getZNumberParser(option: ZNumberSchemaOption = {}) {
  const { parser = zNumberSchemaDefaultParser, range = zNumberSchemaDefaultRange } = option;
  const p = z[parser];

  return range === 'default' ? p() : p()[range]();
}

function withZBigIntCodec(output: ZodBigInt) {
  return z.codec(z.string().nonempty(), output, {
    decode: (string) => BigInt(string),
    encode: (bigint) => bigint.toString(),
  });
}

export const zBigIntCodec = withZBigIntCodec(z.bigint());

export const zDateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (string) => new Date(string),
  encode: (date) => date.toISOString(),
});

export const zSlackTs = z.string().regex(/^\d{10}\.\d{6}$/);

export const zHttpOrHttpsUrl = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });

export const zMinutesToSeconds = zNumber({ parser: 'int32', range: 'positive' }).transform(
  (n) => n * 60,
);

function validateCron(cron: string, allowLengths: number[]) {
  const cronPartRegex = /^(\*|\d+)(-\d+)?(\/\d+)?$/;
  const parts = cron.trim().split(' ');

  return (
    allowLengths.includes(parts.length)
    && parts.every((p) => p.split(',').every((f) => cronPartRegex.test(f)))
  );
}

export const zStandardCron = z.string().refine((cron) => validateCron(cron, [5]), {
  error: 'invalid cron (5 fields required)',
});

export const zExtendedCron = z.string().refine((cron) => validateCron(cron, [5, 6]), {
  error: 'invalid cron (5 or 6 fields required)',
});
