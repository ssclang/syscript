import { assert } from '@syscript/share/util';
import cp from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { lower } from '~/cpp/lower.js';
import { analyzeTdz } from '~/cpp/tdz.js';
import { SscBuildManager } from '~/ssc/manager/build.js';
import { SscManager } from '~/ssc/manager/ssc.js';
import { PathResolver } from '~/util/path-resolver.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');
const clang = PathResolver.clangPath();
const compileFlags = SscBuildManager.clangCompileFlag();

let preludeBuildDir: string;

beforeAll(async () => {
  preludeBuildDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ssc-prelude-'));
  cp.execFileSync(clang, [
    ...compileFlags,
    '-Wno-reserved-module-identifier',
    '-c',
    PathResolver.stdCppmPath(),
    `-fmodule-output=${path.join(preludeBuildDir, 'std.pcm')}`,
    '-o',
    path.join(preludeBuildDir, 'std.o'),
  ]);
  cp.execFileSync(clang, [
    ...compileFlags,
    `-fmodule-file=std=${path.join(preludeBuildDir, 'std.pcm')}`,
    '-c',
    PathResolver.preludeCppmPath(),
    `-fmodule-output=${path.join(preludeBuildDir, 'ssc.pcm')}`,
    '-o',
    path.join(preludeBuildDir, 'ssc.o'),
  ]);
});

afterAll(async () => {
  await fs.rm(preludeBuildDir, { recursive: true, force: true });
});

async function lowerFixture(name: string) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const idJsonPath = path.join(import.meta.dirname, 'id.json');
    const manager = await SscManager.init({ outDir, profile: 'test', idJsonPath });
    const { modules } = await manager.buildManager.compile(path.join(fixtureDir, name));
    const module = modules.at(-1);

    assert(module);

    const sourceFiles = modules.map((m) => m.sourceFile);
    const { topLevelVariableSymbolIdSet, tdzVariableSymbolIdSet, tdzReferenceNodeSet } =
      analyzeTdz(sourceFiles);
    const output = lower(module.sourceFile, {
      kind: 'program',
      pathToId: (path) => manager.idManager.loadId(path),
      topLevelVariableSymbolIdSet,
      tdzVariableSymbolIdSet,
      tdzReferenceNodeSet,
    }).render();

    await manager.flush();
    await compileCpp(outDir, output);

    return output;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

async function compileCpp(dir: string, code: string) {
  const tsCppmPath = path.join(dir, 'ts.cppm');
  const tsPcmPath = path.join(dir, 'ts.pcm');
  const cppPath = path.join(dir, 'file.cpp');
  const moduleFlags = [
    `-fmodule-file=std=${path.join(preludeBuildDir, 'std.pcm')}`,
    `-fmodule-file=ssc=${path.join(preludeBuildDir, 'ssc.pcm')}`,
    `-fmodule-file=ts=${tsPcmPath}`,
  ];

  await fs.writeFile(tsCppmPath, 'export module ts;\n');
  await fs.writeFile(cppPath, code);

  cp.execFileSync(clang, [
    ...compileFlags,
    '-c',
    tsCppmPath,
    `-fmodule-output=${tsPcmPath}`,
    '-o',
    path.join(dir, 'ts.o'),
  ]);
  cp.execFileSync(clang, [
    ...compileFlags,
    ...moduleFlags,
    '-c',
    cppPath,
    '-o',
    path.join(dir, 'file.o'),
  ]);
}

test('ambient-no-declare.ts', async () => {
  await expect(lowerFixture('ambient-no-declare.ts')).rejects.toThrow(
    "ambient-lib.d.ts, but it has no 'declare' modifier",
  );
});

test('ambient-no-export.ts', async () => {
  await expect(lowerFixture('ambient-no-export.ts')).rejects.toThrow(
    "ambient-lib.d.ts, but it has no 'export' modifier",
  );
});

test('ambient-global.ts', async () => {
  await expect(lowerFixture('ambient-global.ts')).rejects.toThrow(
    "ambient-global-lib.d.ts, but it has no 'export' modifier",
  );
});

test('import-function.ts', async () => {
  expect(await lowerFixture('import-function.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__52e5c7f9050443838227dec1ef09b05b {
      extern "C" ssc__core__type__i32 abs(ssc__core__type__i32 ssc__ts__var__x);
      ssc__core__type__i32 ssc__ts__fn__add(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
    }

    namespace ssc__ts__namespace__1e6e8b8df0c640198e243bda7657f43f {
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__status);
    }

    namespace ssc__ts__namespace__7d8f8ecf9a8647789f090a764b137777 {
      void ssc__core__fn__7d8f8ecf9a8647789f090a764b137777() {
        ssc__ts__namespace__1e6e8b8df0c640198e243bda7657f43f::exit(ssc__ts__namespace__52e5c7f9050443838227dec1ef09b05b::ssc__ts__fn__add(ssc__ts__namespace__52e5c7f9050443838227dec1ef09b05b::abs(ssc__core__type__i32{3}), ssc__core__type__i32{4}));
      }
    }"
  `);
});

test('function.ts', async () => {
  expect(await lowerFixture('function.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__7b023686353144c3be21354d03685e76 {
      static void ssc__ts__fn__noop1();
      static void ssc__ts__fn__noop2();
      static ssc__core__type__i32 ssc__ts__fn__noop3();
      static ssc__core__type__i32 ssc__ts__fn__noop4();
      static ssc__core__type__f64 ssc__ts__fn__noop5();
      static ssc__core__type__f64 ssc__ts__fn__noop6();
      static ssc__core__type__f32 ssc__ts__fn__noop7();
      static void ssc__ts__fn__noop8(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__noop9(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__f64 ssc__ts__var__b);
      static void ssc__ts__fn__noop10(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b, ssc__core__type__f32 ssc__ts__var__c);
      static ssc__core__type__i64 ssc__ts__fn__noop11(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b);
      static ssc__core__type__i64 ssc__ts__fn__noop12();
      extern "C" ssc__core__type__i32 abs(ssc__core__type__i32 ssc__ts__var__x);
      static ssc__core__type__i32 ssc__ts__fn__noop13();
      void ssc__ts__fn__noop14();
      static ssc__core__type__i32 ssc__ts__fn__noop15();
      static ssc__core__type__i32 ssc__ts__fn__noop16();
      static void ssc__ts__fn__noop1() {
      }
      static void ssc__ts__fn__noop2() {
        return;
      }
      static ssc__core__type__i32 ssc__ts__fn__noop3() {
        return ssc__core__type__i32{1};
      }
      static ssc__core__type__i32 ssc__ts__fn__noop4() {
        return ssc__core__type__i32{1};
      }
      static ssc__core__type__f64 ssc__ts__fn__noop5() {
        return ssc__core__type__f64{2.0};
      }
      static ssc__core__type__f64 ssc__ts__fn__noop6() {
        return ssc__core__type__f64{2.1};
      }
      static ssc__core__type__f32 ssc__ts__fn__noop7() {
        return ssc__core__type__f32{2.2f};
      }
      static void ssc__ts__fn__noop8(ssc__core__type__i32 ssc__ts__var__a) {
      }
      static ssc__core__type__i32 ssc__ts__fn__noop9(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__f64 ssc__ts__var__b) {
        return ssc__core__type__i32{1};
      }
      static void ssc__ts__fn__noop10(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b, ssc__core__type__f32 ssc__ts__var__c) {
        return;
      }
      static ssc__core__type__i64 ssc__ts__fn__noop11(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b) {
        return (ssc__ts__var__a + ssc__ts__var__b);
      }
      static ssc__core__type__i64 ssc__ts__fn__noop12() {
        return ssc__ts__namespace__7b023686353144c3be21354d03685e76::ssc__ts__fn__noop11(ssc__core__type__i32{3}, ssc__core__type__i64{4});
      }
      static ssc__core__type__i32 ssc__ts__fn__noop13() {
        return ssc__ts__namespace__7b023686353144c3be21354d03685e76::abs(ssc__core__type__i32{5});
      }
      void ssc__ts__fn__noop14() {
      }
      static ssc__core__type__i32 ssc__ts__fn__noop15() {
        return ssc__ts__namespace__7b023686353144c3be21354d03685e76::ssc__ts__fn__noop16();
      }
      static ssc__core__type__i32 ssc__ts__fn__noop16() {
        return ssc__core__type__i32{1};
      }
      void ssc__core__fn__7b023686353144c3be21354d03685e76() {
        ssc__ts__namespace__7b023686353144c3be21354d03685e76::ssc__ts__fn__noop13();
      }
    }"
  `);
});

test('if.ts', async () => {
  expect(await lowerFixture('if.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__b57e1227f3e54e64ad66a84767540f7a {
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b, ssc__core__type__u8 ssc__ts__var__c, ssc__core__type__f64 ssc__ts__var__d, ssc__core__type__f32 ssc__ts__var__e);
      static ssc__core__type__i32 ssc__ts__fn__literal();
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__character(ssc__core__type__char ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b, ssc__core__type__u8 ssc__ts__var__c, ssc__core__type__f64 ssc__ts__var__d, ssc__core__type__f32 ssc__ts__var__e) {
        if (ssc__ts__var__a) {
          return ssc__core__type__i32{1};
        } else if (ssc__ts__var__b != 0) {
          return ssc__core__type__i32{2};
        } else if (ssc__ts__var__c != 0) {
          return ssc__core__type__i32{3};
        } else if (ssc__core__fn__truthy_f64(ssc__ts__var__d)) {
          return ssc__core__type__i32{4};
        } else if (ssc__core__fn__truthy_f32(ssc__ts__var__e)) {
          return ssc__core__type__i32{5};
        } else {
          return ssc__core__type__i32{0};
        }
      }
      static ssc__core__type__i32 ssc__ts__fn__literal() {
        if (false) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__b) {
        return (ssc__ts__var__b + (ssc__ts__var__b + ssc__ts__var__b));
      }
      static ssc__core__type__i32 ssc__ts__fn__character(ssc__core__type__char ssc__ts__var__a) {
        if (ssc__ts__var__a != 0) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__b57e1227f3e54e64ad66a84767540f7a() {
      }
    }"
  `);
});

test('if-union.ts', async () => {
  expect(await lowerFixture('if-union.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__a120821c349e4389af275acfcd239bc5 {
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__union ssc__ts__var__a, ssc__core__type__union ssc__ts__var__b, ssc__core__type__union ssc__ts__var__c);
      static ssc__core__type__i32 ssc__ts__fn__pass(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__sized(ssc__core__type__union ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__literal();
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__union ssc__ts__var__a, ssc__core__type__union ssc__ts__var__b, ssc__core__type__union ssc__ts__var__c) {
        if (ssc__core__fn__truthy_union(ssc__ts__var__a)) {
          return ssc__core__type__i32{1};
        }
        if (ssc__core__fn__truthy_union(ssc__ts__var__b)) {
          return ssc__core__type__i32{2};
        }
        if (ssc__core__fn__truthy_union(ssc__ts__var__c)) {
          return ssc__core__type__i32{4};
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__pass(ssc__core__type__i32 ssc__ts__var__a) {
        return ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__truthy(ssc__ts__var__a, ssc__core__var__null, ssc__core__var__undefined);
      }
      static ssc__core__type__i32 ssc__ts__fn__sized(ssc__core__type__union ssc__ts__var__a) {
        if (ssc__core__fn__truthy_union(ssc__ts__var__a)) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__literal() {
        return ((ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__truthy(ssc__core__type__i32{3}, ssc__core__type__f64{2.5}, ssc__core__var__undefined) + ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__sized(ssc__core__type__u8{3u})) + ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__sized(ssc__core__type__i32{300}));
      }
      void ssc__core__fn__a120821c349e4389af275acfcd239bc5() {
      }
    }"
  `);
});

test('boolean is lowered as boolean, not as a union', async () => {
  const output = await lowerFixture('if.ts');

  expect(output).toContain('ssc__core__type__boolean ssc__ts__var__a');
  expect(output).not.toContain('ssc__core__type__union');
});

test('variable.ts', async () => {
  expect(await lowerFixture('variable.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__70c3185a09264f9e91e0c85bea2350e0 {
      static ssc__core__type__i32 ssc__ts__fn__variables(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__variables(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__b = ssc__ts__var__a;
        const ssc__core__type__i32 ssc__ts__var__c = ssc__core__type__i32{2};
        ssc__core__type__i32 ssc__ts__var__d;
        (ssc__ts__var__d = (ssc__ts__var__b + ssc__ts__var__c));
        (ssc__ts__var__b = ssc__core__type__i32{10});
        const ssc__core__type__union ssc__ts__var__e = ssc__core__type__i32{3};
        if (ssc__ts__var__e.ssc__core__member__value.ssc__core__member__i32 != 0) {
          const ssc__core__type__i32 ssc__ts__var__c = ssc__core__type__i32{100};
          (ssc__ts__var__d = (ssc__ts__var__d + ssc__ts__var__c));
        }
        return (ssc__ts__var__d + ssc__ts__var__b);
      }
      void ssc__core__fn__70c3185a09264f9e91e0c85bea2350e0() {
      }
    }"
  `);
});

test('top-level-variable.ts', async () => {
  expect(await lowerFixture('top-level-variable.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__96969da6635f41dca790c328167a94e8 {
      static ssc__core__type__i32 ssc__ts__var__total;
      static ssc__core__type__i32 ssc__ts__var__step;
      static ssc__core__type__i32 ssc__ts__var__later;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static void ssc__ts__fn__add(ssc__core__type__i32 ssc__ts__var__n);
      static void ssc__ts__fn__add(ssc__core__type__i32 ssc__ts__var__n) {
        (ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total = (ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total + ssc__ts__var__n));
      }
      void ssc__core__fn__96969da6635f41dca790c328167a94e8() {
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total = ssc__core__type__i32{1};
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__step = ssc__core__type__i32{2};
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__fn__add(ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__step);
        (ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__later = (ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total + ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__step));
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__fn__add(ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__later);
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::exit(ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total);
      }
    }"
  `);
});

test('top-level-import.ts', async () => {
  expect(await lowerFixture('top-level-import.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c {
      void ssc__ts__fn__increase(ssc__core__type__i32 ssc__ts__var__n);
      extern ssc__core__type__i32 ssc__ts__var__count;
    }

    namespace ssc__ts__namespace__4a96ace858804901b9f845eef13209bd {
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__4a96ace858804901b9f845eef13209bd() {
        ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c::ssc__ts__fn__increase(ssc__core__type__i32{3});
        ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c::ssc__ts__fn__increase(ssc__core__type__i32{4});
        ssc__ts__namespace__4a96ace858804901b9f845eef13209bd::exit(ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c::ssc__ts__var__count);
      }
    }"
  `);
});

test('top-level-rename.ts', async () => {
  expect(await lowerFixture('top-level-rename.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c {
      void ssc__ts__fn__increase(ssc__core__type__i32 ssc__ts__var__n);
      extern ssc__core__type__i32 ssc__ts__var__count;
    }

    namespace ssc__ts__namespace__d74c3b6a8e5c4f809a32af5c4b33eb89 {
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__d74c3b6a8e5c4f809a32af5c4b33eb89() {
        ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c::ssc__ts__fn__increase(ssc__core__type__i32{5});
        ssc__ts__namespace__d74c3b6a8e5c4f809a32af5c4b33eb89::exit(ssc__ts__namespace__97270c275bf64ffd9168904fc39caf2c::ssc__ts__var__count);
      }
    }"
  `);
});

test('tdz-function.ts', async () => {
  expect(await lowerFixture('tdz-function.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4 {
      static ssc__core__type__i32 ssc__ts__var__value;
      static ssc__core__type__boolean ssc__ts__tdz__value;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__read();
      static ssc__core__type__i32 ssc__ts__fn__read() {
        return (ssc__core__fn__throw_if_tdz(ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4::ssc__ts__tdz__value, "value"), ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4::ssc__ts__var__value);
      }
      void ssc__core__fn__5671668cf855448397b0d0289e41fdf4() {
        ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4::exit(ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4::ssc__ts__fn__read());
        ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4::ssc__ts__var__value = ssc__core__type__i32{7};
        ssc__ts__namespace__5671668cf855448397b0d0289e41fdf4::ssc__ts__tdz__value = true;
      }
    }"
  `);
});

test('tdz-cycle.ts', async () => {
  expect(await lowerFixture('tdz-cycle.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__08bc9d3431184edc8a6d29100a31c9c6 {
      extern ssc__core__type__i32 ssc__ts__var__libValue;
    }

    namespace ssc__ts__namespace__a464ffda0dee47029c62da4984859257 {
      ssc__core__type__i32 ssc__ts__var__value;
      ssc__core__type__boolean ssc__ts__tdz__value;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      ssc__core__type__i32 ssc__ts__fn__readValue();
      ssc__core__type__i32 ssc__ts__fn__readValue() {
        return (ssc__core__fn__throw_if_tdz(ssc__ts__namespace__a464ffda0dee47029c62da4984859257::ssc__ts__tdz__value, "value"), ssc__ts__namespace__a464ffda0dee47029c62da4984859257::ssc__ts__var__value);
      }
      void ssc__core__fn__a464ffda0dee47029c62da4984859257() {
        ssc__ts__namespace__a464ffda0dee47029c62da4984859257::ssc__ts__var__value = ssc__core__type__i32{7};
        ssc__ts__namespace__a464ffda0dee47029c62da4984859257::ssc__ts__tdz__value = true;
        ssc__ts__namespace__a464ffda0dee47029c62da4984859257::exit(ssc__ts__namespace__08bc9d3431184edc8a6d29100a31c9c6::ssc__ts__var__libValue);
      }
    }"
  `);
});

test('tdz-reference.ts', async () => {
  expect(await lowerFixture('tdz-reference.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9 {
      static ssc__core__type__boolean ssc__ts__var__run;
      static ssc__core__type__i32 ssc__ts__var__value;
      static ssc__core__type__boolean ssc__ts__tdz__value;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__early();
      static ssc__core__type__i32 ssc__ts__fn__late();
      static ssc__core__type__i32 ssc__ts__fn__early() {
        return (ssc__core__fn__throw_if_tdz(ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__tdz__value, "value"), ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__var__value);
      }
      static ssc__core__type__i32 ssc__ts__fn__late() {
        return ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__var__value;
      }
      void ssc__core__fn__810e2f5dcdb444ab98651ccb6daaccc9() {
        ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__var__run = false;
        if (ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__var__run) {
          ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::exit(ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__fn__early());
        }
        ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__var__value = ssc__core__type__i32{7};
        ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__tdz__value = true;
        ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::exit(ssc__ts__namespace__810e2f5dcdb444ab98651ccb6daaccc9::ssc__ts__fn__late());
      }
    }"
  `);
});

test('tdz-extern.ts', async () => {
  expect(await lowerFixture('tdz-extern.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__1425e95c6b6f4d29909442e710fad83c {
      extern ssc__core__type__i32 ssc__ts__var__value;
    }

    namespace ssc__ts__namespace__1b16c24733144fe4ac077e675f354b73 {
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__1b16c24733144fe4ac077e675f354b73() {
        ssc__ts__namespace__1b16c24733144fe4ac077e675f354b73::exit(ssc__ts__namespace__1425e95c6b6f4d29909442e710fad83c::ssc__ts__var__value);
      }
    }"
  `);
});
