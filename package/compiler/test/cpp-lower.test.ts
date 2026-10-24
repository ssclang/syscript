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
        return ssc__core__fn__add(static_cast<ssc__core__type__i64>(ssc__ts__var__a), ssc__ts__var__b, "i64");
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
        return ssc__core__fn__add(ssc__ts__var__b, (ssc__core__fn__add(ssc__ts__var__b, ssc__ts__var__b, "i32")), "i32");
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
        return ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__truthy(ssc__core__type__i64{3}, ssc__core__type__f64{2.5}, ssc__core__var__undefined), ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__sized(ssc__core__type__i64{3}), "i32"), ssc__ts__namespace__a120821c349e4389af275acfcd239bc5::ssc__ts__fn__sized(ssc__core__type__i64{300}), "i32");
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
        (ssc__ts__var__d = ssc__core__fn__add(ssc__ts__var__b, ssc__ts__var__c, "i32"));
        (ssc__ts__var__b = ssc__core__type__i32{10});
        const ssc__core__type__union ssc__ts__var__e = ssc__core__type__i64{3};
        if (ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__e) != 0) {
          const ssc__core__type__i32 ssc__ts__var__c = ssc__core__type__i32{100};
          (ssc__ts__var__d = ssc__core__fn__add(ssc__ts__var__d, ssc__ts__var__c, "i32"));
        }
        return ssc__core__fn__add(ssc__ts__var__d, ssc__ts__var__b, "i32");
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
        (ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total = ssc__core__fn__add(ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total, ssc__ts__var__n, "i32"));
      }
      void ssc__core__fn__96969da6635f41dca790c328167a94e8() {
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total = ssc__core__type__i32{1};
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__step = ssc__core__type__i32{2};
        ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__fn__add(ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__step);
        (ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__later = ssc__core__fn__add(ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__total, ssc__ts__namespace__96969da6635f41dca790c328167a94e8::ssc__ts__var__step, "i32"));
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

test('arithmetic.ts', async () => {
  expect(await lowerFixture('arithmetic.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__cc133faefdcc4783a157452c807c38ef {
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__integer(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__f64 ssc__ts__fn__float(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__f32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__integer(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return ssc__core__fn__rem((ssc__core__fn__div((ssc__core__fn__sub(ssc__core__fn__mul(ssc__ts__var__a, ssc__core__type__i32{3}, "i32"), static_cast<ssc__core__type__i32>(ssc__ts__var__b), "i32")), ssc__core__type__i32{2}, "i32")), ssc__core__type__i32{100}, "i32");
      }
      static ssc__core__type__f64 ssc__ts__fn__float(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__f32 ssc__ts__var__b) {
        return __builtin_fmod((((((ssc__ts__var__a * ssc__core__type__f64{3.0}) - static_cast<ssc__core__type__f64>(ssc__ts__var__b))) / ssc__core__type__f64{2.0})), ssc__core__type__f64{100.0});
      }
      void ssc__core__fn__cc133faefdcc4783a157452c807c38ef() {
        ssc__ts__namespace__cc133faefdcc4783a157452c807c38ef::ssc__ts__fn__float(ssc__core__type__f64{1.0}, ssc__core__type__f32{2.0f});
        ssc__ts__namespace__cc133faefdcc4783a157452c807c38ef::exit(ssc__ts__namespace__cc133faefdcc4783a157452c807c38ef::ssc__ts__fn__integer(ssc__core__type__i32{20}, ssc__core__type__u8{4u}));
      }
    }"
  `);
});

test('comparison.ts', async () => {
  expect(await lowerFixture('comparison.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc {
      static ssc__core__type__i32 ssc__ts__var__zero;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__boolean ssc__ts__fn__less(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u32 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__lessEqual(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__greater(ssc__core__type__u64 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__greaterEqual(ssc__core__type__i16 ssc__ts__var__a, ssc__core__type__i16 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__equal(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__f32 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__notEqual(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__sameBoolean(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__boolean ssc__ts__var__b, ssc__core__type__boolean ssc__ts__var__c);
      static ssc__core__type__boolean ssc__ts__fn__less(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u32 ssc__ts__var__b) {
        return (static_cast<ssc__core__type__i64>(ssc__ts__var__a) < static_cast<ssc__core__type__i64>(ssc__ts__var__b));
      }
      static ssc__core__type__boolean ssc__ts__fn__lessEqual(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return (ssc__ts__var__a <= ssc__ts__var__b);
      }
      static ssc__core__type__boolean ssc__ts__fn__greater(ssc__core__type__u64 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return (ssc__ts__var__a > static_cast<ssc__core__type__u64>(ssc__ts__var__b));
      }
      static ssc__core__type__boolean ssc__ts__fn__greaterEqual(ssc__core__type__i16 ssc__ts__var__a, ssc__core__type__i16 ssc__ts__var__b) {
        return (ssc__ts__var__a >= ssc__ts__var__b);
      }
      static ssc__core__type__boolean ssc__ts__fn__equal(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__f32 ssc__ts__var__b) {
        return (ssc__ts__var__a == static_cast<ssc__core__type__f64>(ssc__ts__var__b));
      }
      static ssc__core__type__boolean ssc__ts__fn__notEqual(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b) {
        return (!(static_cast<ssc__core__type__i64>(ssc__ts__var__a) == ssc__ts__var__b));
      }
      static ssc__core__type__boolean ssc__ts__fn__sameBoolean(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__boolean ssc__ts__var__b, ssc__core__type__boolean ssc__ts__var__c) {
        return (((!(ssc__ts__var__a == ssc__ts__var__b))) == ssc__ts__var__c);
      }
      void ssc__core__fn__f3b73e93e8ed47a683eb1328fda087bc() {
        ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__zero = ssc__core__type__i32{0};
        ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__type__i32{0};
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__less(ssc__core__fn__sub(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__zero, ssc__core__type__i32{1}, "i32"), ssc__core__type__u32{4000000000u})) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__lessEqual(ssc__core__type__u8{3u}, ssc__core__type__u8{3u})) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__greater(ssc__core__type__u64{5u}, ssc__core__type__u8{3u})) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__greaterEqual(ssc__core__type__i16{3}, ssc__core__type__i16{4})) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__equal(ssc__core__type__f64{0.5}, ssc__core__type__f32{0.5f})) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__notEqual(ssc__core__type__i32{1}, ssc__core__type__i64{2})) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__fn__sameBoolean(true, false, true)) {
          (ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::exit(ssc__ts__namespace__f3b73e93e8ed47a683eb1328fda087bc::ssc__ts__var__result);
      }
    }"
  `);
});

test('literal-type.ts', async () => {
  expect(await lowerFixture('literal-type.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a {
      static ssc__core__type__f64 ssc__ts__var__five;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__constant(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__assignment(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__u64 ssc__ts__fn__exact(ssc__core__type__u64 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__ts__var__a, (ssc__core__type__i32{5}), "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__constant(ssc__core__type__i32 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__ts__var__a, static_cast<ssc__core__type__i32>(ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__var__five), "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__assignment(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__b = ssc__core__type__i32{0};
        const ssc__core__type__i32 ssc__ts__var__c = ssc__core__fn__add(ssc__ts__var__a, (static_cast<ssc__core__type__i32>((ssc__ts__var__b = ssc__core__type__i32{5}))), "i32");
        return ssc__core__fn__add(ssc__ts__var__c, ssc__ts__var__b, "i32");
      }
      static ssc__core__type__u64 ssc__ts__fn__exact(ssc__core__type__u64 ssc__ts__var__a) {
        return ssc__core__fn__sub(ssc__ts__var__a, ssc__core__type__u64{9007199254740993u}, "u64");
      }
      void ssc__core__fn__82416a1bd41c47c39a3a1276e34f3f3a() {
        ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__var__five = ssc__core__type__f64{5.0};
        ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__var__result = ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__fn__parenthesized(ssc__core__type__i32{1}), ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__fn__constant(ssc__core__type__i32{1}), "i32"), ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__fn__assignment(ssc__core__type__i32{1}), "i32");
        if ((ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__fn__exact(ssc__core__type__u64{9007199254740995u}) == ssc__core__type__u64{2u})) {
          (ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__var__result, ssc__core__type__i32{100}, "i32"));
        }
        ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::exit(ssc__ts__namespace__82416a1bd41c47c39a3a1276e34f3f3a::ssc__ts__var__result);
      }
    }"
  `);
});

test('bitwise.ts', async () => {
  expect(await lowerFixture('bitwise.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891 {
      static ssc__core__type__i32 ssc__ts__var__zero;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__u8 ssc__ts__fn__and(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__or(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__u16 ssc__ts__fn__xor(ssc__core__type__u16 ssc__ts__var__a, ssc__core__type__u16 ssc__ts__var__b);
      static ssc__core__type__u8 ssc__ts__fn__shiftLeft(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__shiftRight(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__unsignedShiftRight(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__u8 ssc__ts__fn__and(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return ssc__core__fn__bitwise_and(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__i32 ssc__ts__fn__or(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return ssc__core__fn__bitwise_or(ssc__ts__var__a, static_cast<ssc__core__type__i32>(ssc__ts__var__b));
      }
      static ssc__core__type__u16 ssc__ts__fn__xor(ssc__core__type__u16 ssc__ts__var__a, ssc__core__type__u16 ssc__ts__var__b) {
        return ssc__core__fn__bitwise_xor(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__u8 ssc__ts__fn__shiftLeft(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return ssc__core__fn__shift_left(ssc__ts__var__a, ssc__ts__var__b, "u8");
      }
      static ssc__core__type__i32 ssc__ts__fn__shiftRight(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return ssc__core__fn__shift_right(ssc__ts__var__a, ssc__ts__var__b, "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__unsignedShiftRight(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return ssc__core__fn__unsigned_shift_right(ssc__ts__var__a, ssc__ts__var__b, "i32");
      }
      void ssc__core__fn__3c51c1009f204bef853a6de99f55d891() {
        ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__zero = ssc__core__type__i32{0};
        ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__fn__and(ssc__core__type__u8{12u}, ssc__core__type__u8{10u}) == ssc__core__type__u8{8u})) {
          (ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__fn__or(ssc__core__type__i32{16}, ssc__core__type__u8{3u}) == ssc__core__type__i32{19})) {
          (ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__fn__xor(ssc__core__type__u16{5u}, ssc__core__type__u16{3u}) == ssc__core__type__u16{6u})) {
          (ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__fn__shiftLeft(ssc__core__type__u8{200u}, ssc__core__type__u8{1u}) == ssc__core__type__u8{144u})) {
          (ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__fn__shiftRight(ssc__core__fn__sub(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__zero, ssc__core__type__i32{8}, "i32"), ssc__core__type__i32{1}) == ssc__core__fn__sub(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__zero, ssc__core__type__i32{4}, "i32"))) {
          (ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__fn__unsignedShiftRight(ssc__core__fn__sub(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__zero, ssc__core__type__i32{1}, "i32"), ssc__core__type__i32{1}) == ssc__core__type__i32{2147483647})) {
          (ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::exit(ssc__ts__namespace__3c51c1009f204bef853a6de99f55d891::ssc__ts__var__result);
      }
    }"
  `);
});

test('logical.ts', async () => {
  expect(await lowerFixture('logical.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e {
      static ssc__core__type__i32 ssc__ts__var__calls;
      static ssc__core__type__f64 ssc__ts__var__zero;
      static ssc__core__type__i32 ssc__ts__var__n;
      static ssc__core__type__f64 ssc__ts__var__x;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__count(ssc__core__type__i32 ssc__ts__var__value);
      static ssc__core__type__i32 ssc__ts__fn__and(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__or(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__f64 ssc__ts__fn__orFloat(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__both(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__boolean ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__count(ssc__core__type__i32 ssc__ts__var__value) {
        (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__calls = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__calls, ssc__core__type__i32{1}, "i32"));
        return ssc__ts__var__value;
      }
      static ssc__core__type__i32 ssc__ts__fn__and(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return [&] { const ssc__core__type__i32 left = ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__count(ssc__ts__var__a); return left != 0 ? ssc__ts__var__b : left; }();
      }
      static ssc__core__type__i32 ssc__ts__fn__or(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return [&] { const ssc__core__type__i32 left = ssc__ts__var__a; return left != 0 ? left : static_cast<ssc__core__type__i32>(ssc__ts__var__b); }();
      }
      static ssc__core__type__f64 ssc__ts__fn__orFloat(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return [&] { const ssc__core__type__f64 left = ssc__ts__var__a; return ssc__core__fn__truthy_f64(left) ? left : static_cast<ssc__core__type__f64>(ssc__ts__var__b); }();
      }
      static ssc__core__type__boolean ssc__ts__fn__both(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__boolean ssc__ts__var__b) {
        return (ssc__ts__var__a && ssc__ts__var__b);
      }
      void ssc__core__fn__d2ca634b5a8f42939b6ef22a872e5a1e() {
        ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__calls = ssc__core__type__i32{0};
        ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__zero = ssc__core__type__f64{0.0};
        ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__n = ssc__core__type__i32{0};
        ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__x = ssc__core__type__f64{0.5};
        ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__and(ssc__core__type__i32{0}, ssc__core__type__i32{5}) == ssc__core__type__i32{0})) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__and(ssc__core__type__i32{3}, ssc__core__type__i32{5}) == ssc__core__type__i32{5})) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__or(ssc__core__type__i32{0}, ssc__core__type__u8{7u}) == ssc__core__type__i32{7})) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__or(ssc__core__type__i32{4}, ssc__core__type__u8{7u}) == ssc__core__type__i32{4})) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__orFloat((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__zero / ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__zero), ssc__core__type__i32{9}) == ssc__core__type__f64{9.0})) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__fn__both(true, true)) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if ((ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__calls == ssc__core__type__i32{2})) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        if (ssc__core__fn__truthy_f64([&] { const ssc__core__type__f64 left = static_cast<ssc__core__type__f64>(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__n); return ssc__core__fn__truthy_f64(left) ? left : ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__x; }())) {
          (ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result, ssc__core__type__i32{128}, "i32"));
        }
        ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::exit(ssc__ts__namespace__d2ca634b5a8f42939b6ef22a872e5a1e::ssc__ts__var__result);
      }
    }"
  `);
});

test('unary.ts', async () => {
  expect(await lowerFixture('unary.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__72eede9507214e128888953c2d497771 {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i16 ssc__ts__fn__negate(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__f32 ssc__ts__fn__negateFloat(ssc__core__type__f32 ssc__ts__var__a);
      static ssc__core__type__f64 ssc__ts__fn__plus(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__boolean ssc__ts__fn__not(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__u8 ssc__ts__fn__complement(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__i64 ssc__ts__fn__minimum();
      static ssc__core__type__i32 ssc__ts__fn__addNegative(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i16 ssc__ts__fn__negate(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__core__fn__sub(ssc__core__type__i16{0}, static_cast<ssc__core__type__i16>(ssc__ts__var__a), "i16");
      }
      static ssc__core__type__f32 ssc__ts__fn__negateFloat(ssc__core__type__f32 ssc__ts__var__a) {
        return (-ssc__ts__var__a);
      }
      static ssc__core__type__f64 ssc__ts__fn__plus(ssc__core__type__i32 ssc__ts__var__a) {
        return static_cast<ssc__core__type__f64>(ssc__ts__var__a);
      }
      static ssc__core__type__boolean ssc__ts__fn__not(ssc__core__type__i32 ssc__ts__var__a) {
        return (!(ssc__ts__var__a != 0));
      }
      static ssc__core__type__u8 ssc__ts__fn__complement(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__core__fn__bitwise_not(ssc__ts__var__a);
      }
      static ssc__core__type__i64 ssc__ts__fn__minimum() {
        return ssc__core__type__i64{-9223372036854775807 - 1};
      }
      static ssc__core__type__i32 ssc__ts__fn__addNegative(ssc__core__type__i32 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__ts__var__a, ssc__core__type__i32{-1}, "i32");
      }
      void ssc__core__fn__72eede9507214e128888953c2d497771() {
        ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__negate(ssc__core__type__u8{200u}) == ssc__core__type__i16{-200})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__negateFloat(ssc__core__type__f32{1.5f}) == ssc__core__type__f32{-1.5f})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__plus(ssc__core__type__i32{7}) == ssc__core__type__f64{7.0})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__not(ssc__core__type__i32{0})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__complement(ssc__core__type__u8{5u}) == ssc__core__type__u8{250u})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__minimum() < ssc__core__type__i64{-9223372036854775807})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if ((ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__fn__addNegative(ssc__core__type__i32{5}) == ssc__core__type__i32{4})) {
          (ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        ssc__ts__namespace__72eede9507214e128888953c2d497771::exit(ssc__ts__namespace__72eede9507214e128888953c2d497771::ssc__ts__var__result);
      }
    }"
  `);
});

test('update.ts', async () => {
  expect(await lowerFixture('update.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0 {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__postfix(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__prefix(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__u8 ssc__ts__fn__decrement(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__f64 ssc__ts__fn__float(ssc__core__type__f64 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__compound(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__f64 ssc__ts__fn__compoundFloat(ssc__core__type__f64 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__postfix(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__v = ssc__ts__var__a;
        const ssc__core__type__i32 ssc__ts__var__previous = ssc__core__fn__increment_postfix(ssc__ts__var__v, "i32");
        return ssc__core__fn__add(ssc__core__fn__mul(ssc__ts__var__previous, ssc__core__type__i32{10}, "i32"), ssc__ts__var__v, "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__prefix(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__v = ssc__ts__var__a;
        const ssc__core__type__i32 ssc__ts__var__next = ssc__core__fn__increment_prefix(ssc__ts__var__v, "i32");
        return ssc__core__fn__add(ssc__core__fn__mul(ssc__ts__var__next, ssc__core__type__i32{10}, "i32"), ssc__ts__var__v, "i32");
      }
      static ssc__core__type__u8 ssc__ts__fn__decrement(ssc__core__type__u8 ssc__ts__var__a) {
        ssc__core__type__u8 ssc__ts__var__v = ssc__ts__var__a;
        ssc__core__fn__decrement_postfix(ssc__ts__var__v, "u8");
        ssc__core__fn__decrement_prefix(ssc__ts__var__v, "u8");
        return ssc__ts__var__v;
      }
      static ssc__core__type__f64 ssc__ts__fn__float(ssc__core__type__f64 ssc__ts__var__a) {
        ssc__core__type__f64 ssc__ts__var__v = ssc__ts__var__a;
        (ssc__ts__var__v++);
        return ssc__ts__var__v;
      }
      static ssc__core__type__i32 ssc__ts__fn__compound(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__v = ssc__ts__var__a;
        (ssc__ts__var__v = ssc__core__fn__add(ssc__ts__var__v, ssc__core__type__i32{10}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__sub(ssc__ts__var__v, ssc__core__type__i32{2}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__mul(ssc__ts__var__v, ssc__core__type__i32{3}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__div(ssc__ts__var__v, ssc__core__type__i32{2}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__rem(ssc__ts__var__v, ssc__core__type__i32{7}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__shift_left(ssc__ts__var__v, ssc__core__type__i32{2}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__shift_right(ssc__ts__var__v, ssc__core__type__i32{1}, "i32"));
        (ssc__ts__var__v = ssc__core__fn__bitwise_or(ssc__ts__var__v, ssc__core__type__i32{1}));
        (ssc__ts__var__v = ssc__core__fn__bitwise_and(ssc__ts__var__v, ssc__core__type__i32{7}));
        (ssc__ts__var__v = ssc__core__fn__bitwise_xor(ssc__ts__var__v, ssc__core__type__i32{2}));
        return ssc__ts__var__v;
      }
      static ssc__core__type__f64 ssc__ts__fn__compoundFloat(ssc__core__type__f64 ssc__ts__var__a) {
        ssc__core__type__f64 ssc__ts__var__v = ssc__ts__var__a;
        (ssc__ts__var__v = (ssc__ts__var__v + ssc__core__type__f64{0.5}));
        (ssc__ts__var__v = __builtin_fmod(ssc__ts__var__v, ssc__core__type__f64{2.0}));
        return ssc__ts__var__v;
      }
      void ssc__core__fn__12fb5f16060c4350ae93fd09ed8e53f0() {
        ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__fn__postfix(ssc__core__type__i32{3}) == ssc__core__type__i32{34})) {
          (ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__fn__prefix(ssc__core__type__i32{3}) == ssc__core__type__i32{44})) {
          (ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__fn__decrement(ssc__core__type__u8{5u}) == ssc__core__type__u8{3u})) {
          (ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__fn__float(ssc__core__type__f64{1.5}) == ssc__core__type__f64{2.5})) {
          (ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__fn__compound(ssc__core__type__i32{4}) == ssc__core__type__i32{3})) {
          (ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__fn__compoundFloat(ssc__core__type__f64{3.0}) == ssc__core__type__f64{1.5})) {
          (ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::exit(ssc__ts__namespace__12fb5f16060c4350ae93fd09ed8e53f0::ssc__ts__var__result);
      }
    }"
  `);
});

test('loop.ts', async () => {
  expect(await lowerFixture('loop.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9 {
      static ssc__core__type__i32 ssc__ts__var__top;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__sum(ssc__core__type__i32 ssc__ts__var__n);
      static ssc__core__type__i32 ssc__ts__fn__countdown(ssc__core__type__i32 ssc__ts__var__n);
      static ssc__core__type__i32 ssc__ts__fn__oddSum(ssc__core__type__i32 ssc__ts__var__n);
      static ssc__core__type__i32 ssc__ts__fn__pair(ssc__core__type__i32 ssc__ts__var__n);
      static ssc__core__type__i32 ssc__ts__fn__block();
      static ssc__core__type__i32 ssc__ts__fn__sum(ssc__core__type__i32 ssc__ts__var__n) {
        ssc__core__type__i32 ssc__ts__var__total = ssc__core__type__i32{0};
        for (ssc__core__type__i32 ssc__ts__var__i = ssc__core__type__i32{0}; (ssc__ts__var__i < ssc__ts__var__n); ssc__core__fn__increment_postfix(ssc__ts__var__i, "i32")) {
          (ssc__ts__var__total = ssc__core__fn__add(ssc__ts__var__total, ssc__ts__var__i, "i32"));
        }
        return ssc__ts__var__total;
      }
      static ssc__core__type__i32 ssc__ts__fn__countdown(ssc__core__type__i32 ssc__ts__var__n) {
        ssc__core__type__i32 ssc__ts__var__count = ssc__core__type__i32{0};
        while ((ssc__ts__var__n > ssc__core__type__i32{0})) {
          ssc__core__fn__increment_postfix(ssc__ts__var__count, "i32");
          ssc__core__fn__decrement_postfix(ssc__ts__var__n, "i32");
        }
        return ssc__ts__var__count;
      }
      static ssc__core__type__i32 ssc__ts__fn__oddSum(ssc__core__type__i32 ssc__ts__var__n) {
        ssc__core__type__i32 ssc__ts__var__total = ssc__core__type__i32{0};
        for (ssc__core__type__i32 ssc__ts__var__i = ssc__core__type__i32{0}; (ssc__ts__var__i < ssc__core__type__i32{100}); ssc__core__fn__increment_postfix(ssc__ts__var__i, "i32")) {
          if ((ssc__ts__var__i >= ssc__ts__var__n)) {
            break;
          }
          if ((ssc__core__fn__rem(ssc__ts__var__i, ssc__core__type__i32{2}, "i32") == ssc__core__type__i32{0})) {
            continue;
          }
          (ssc__ts__var__total = ssc__core__fn__add(ssc__ts__var__total, ssc__ts__var__i, "i32"));
        }
        return ssc__ts__var__total;
      }
      static ssc__core__type__i32 ssc__ts__fn__pair(ssc__core__type__i32 ssc__ts__var__n) {
        ssc__core__type__i32 ssc__ts__var__total = ssc__core__type__i32{0};
        {
          ssc__core__type__i32 ssc__ts__var__i = ssc__core__type__i32{0};
          ssc__core__type__u8 ssc__ts__var__j = ssc__core__type__u8{10u};
          for (; (ssc__ts__var__i < ssc__ts__var__n); ssc__core__fn__increment_postfix(ssc__ts__var__i, "i32")) {
            (ssc__ts__var__total = ssc__core__fn__add(ssc__ts__var__total, static_cast<ssc__core__type__i32>(ssc__ts__var__j), "i32"));
          }
        }
        return ssc__ts__var__total;
      }
      static ssc__core__type__i32 ssc__ts__fn__block() {
        ssc__core__type__i32 ssc__ts__var__v = ssc__core__type__i32{1};
        {
          const ssc__core__type__i32 ssc__ts__var__w = ssc__core__type__i32{2};
          (ssc__ts__var__v = ssc__core__fn__add(ssc__ts__var__v, ssc__ts__var__w, "i32"));
        }
        return ssc__ts__var__v;
      }
      void ssc__core__fn__24836216d5f549ab96a0281fbcb414a9() {
        ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__var__top = ssc__core__type__i32{0};
        for (ssc__core__type__i32 ssc__ts__var__k = ssc__core__type__i32{0}; (ssc__ts__var__k < ssc__core__type__i32{3}); ssc__core__fn__increment_postfix(ssc__ts__var__k, "i32")) {
          (ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__var__top = ssc__core__fn__add(ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__var__top, ssc__ts__var__k, "i32"));
        }
        ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::exit(ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__fn__sum(ssc__core__type__i32{5}), ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__fn__countdown(ssc__core__type__i32{4}), "i32"), ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__fn__oddSum(ssc__core__type__i32{10}), "i32"), ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__fn__pair(ssc__core__type__i32{3}), "i32"), ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__fn__block(), "i32"), ssc__ts__namespace__24836216d5f549ab96a0281fbcb414a9::ssc__ts__var__top, "i32"));
      }
    }"
  `);
});

test('constructor.ts', async () => {
  expect(await lowerFixture('constructor.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i64 ssc__ts__fn__widen(ssc__core__type__i32 ssc__ts__var__v);
      static ssc__core__type__char ssc__ts__fn__of(ssc__core__type__u32 ssc__ts__var__codePoint);
      static ssc__core__type__u32 ssc__ts__fn__offset(ssc__core__type__char ssc__ts__var__c);
      static ssc__core__type__i64 ssc__ts__fn__widenChar(ssc__core__type__char ssc__ts__var__c, ssc__core__type__i32 ssc__ts__var__n);
      static ssc__core__type__i64 ssc__ts__fn__widen(ssc__core__type__i32 ssc__ts__var__v) {
        return static_cast<ssc__core__type__i64>(ssc__ts__var__v);
      }
      static ssc__core__type__char ssc__ts__fn__of(ssc__core__type__u32 ssc__ts__var__codePoint) {
        return ssc__core__fn__char(ssc__ts__var__codePoint);
      }
      static ssc__core__type__u32 ssc__ts__fn__offset(ssc__core__type__char ssc__ts__var__c) {
        return ssc__core__fn__sub(static_cast<ssc__core__type__u32>(ssc__ts__var__c), ssc__core__type__u32{65u}, "u32");
      }
      static ssc__core__type__i64 ssc__ts__fn__widenChar(ssc__core__type__char ssc__ts__var__c, ssc__core__type__i32 ssc__ts__var__n) {
        return ssc__core__fn__add(static_cast<ssc__core__type__i64>(ssc__ts__var__c), static_cast<ssc__core__type__i64>(ssc__ts__var__n), "i64");
      }
      void ssc__core__fn__ef5e302400984959bf7ae0475d5c0bef() {
        ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__fn__widen(ssc__core__type__i32{-1}) == ssc__core__type__i64{-1})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__core__type__u8{255u} == ssc__core__type__u8{255u})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((static_cast<ssc__core__type__f64>(ssc__core__type__u32{7u}) == ssc__core__type__f64{7.0})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((static_cast<ssc__core__type__u32>(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__fn__of(ssc__core__type__u32{65u})) == ssc__core__type__u32{65u})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((static_cast<ssc__core__type__u32>(ssc__core__fn__char(ssc__core__type__u32{128077u})) == ssc__core__type__u32{128077u})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((static_cast<ssc__core__type__u32>(ssc__core__fn__char(ssc__core__type__u32{65u})) == ssc__core__type__u32{65u})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if ((ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__fn__offset(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__fn__of(ssc__core__type__u32{67u})) == ssc__core__type__u32{2u})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        if ((ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__fn__widenChar(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__fn__of(ssc__core__type__u32{65u}), ssc__core__type__i32{-66}) == ssc__core__type__i64{-1})) {
          (ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result, ssc__core__type__i32{128}, "i32"));
        }
        ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::exit(ssc__ts__namespace__ef5e302400984959bf7ae0475d5c0bef::ssc__ts__var__result);
      }
    }"
  `);
});

test('wrap.ts', async () => {
  expect(await lowerFixture('wrap.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86 {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__boolean ssc__ts__fn__u8s(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__boolean ssc__ts__fn__i32s(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__boolean ssc__ts__fn__u16s(ssc__core__type__u16 ssc__ts__var__a);
      static ssc__core__type__boolean ssc__ts__fn__u8s(ssc__core__type__u8 ssc__ts__var__a) {
        return (((ssc__core__fn__add_wrap(ssc__ts__var__a, ssc__core__type__u8{100u}) == ssc__core__type__u8{44u}) && (ssc__core__fn__sub_wrap(ssc__ts__var__a, ssc__core__type__u8{201u}) == ssc__core__type__u8{255u})) && (ssc__core__fn__mul_wrap(ssc__ts__var__a, ssc__core__type__u8{2u}) == ssc__core__type__u8{144u}));
      }
      static ssc__core__type__boolean ssc__ts__fn__i32s(ssc__core__type__i32 ssc__ts__var__a) {
        return ((ssc__core__fn__add_wrap(ssc__ts__var__a, ssc__core__type__i32{1}) == ssc__core__type__i32{-2147483648}) && (ssc__core__fn__mul_wrap(ssc__ts__var__a, ssc__core__type__i32{2}) == ssc__core__type__i32{-2}));
      }
      static ssc__core__type__boolean ssc__ts__fn__u16s(ssc__core__type__u16 ssc__ts__var__a) {
        return (ssc__core__fn__mul_wrap(ssc__ts__var__a, ssc__ts__var__a) == ssc__core__type__u16{1u});
      }
      void ssc__core__fn__ad9c07b9f7ff48569b2e10b0bdb52c86() {
        ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result = ssc__core__type__i32{0};
        if (ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__fn__u8s(ssc__core__type__u8{200u})) {
          (ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__fn__i32s(ssc__core__type__i32{2147483647})) {
          (ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__fn__u16s(ssc__core__type__u16{65535u})) {
          (ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::exit(ssc__ts__namespace__ad9c07b9f7ff48569b2e10b0bdb52c86::ssc__ts__var__result);
      }
    }"
  `);
});

test('union-value.ts', async () => {
  expect(await lowerFixture('union-value.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22 {
      static ssc__core__type__union ssc__ts__var__stored;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__v);
      static ssc__core__type__i32 ssc__ts__fn__fromU8(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__union ssc__ts__fn__returned(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__store(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__union ssc__ts__fn__widen(ssc__core__type__union ssc__ts__var__v);
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__v) {
        if (ssc__core__fn__truthy_union(ssc__ts__var__v)) {
          return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__v);
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__fromU8(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__orZero(ssc__ts__var__a);
      }
      static ssc__core__type__union ssc__ts__fn__returned(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__ts__var__a;
      }
      static ssc__core__type__i32 ssc__ts__fn__store(ssc__core__type__u8 ssc__ts__var__a) {
        (ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__stored = ssc__ts__var__a);
        return ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__orZero(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__stored));
      }
      static ssc__core__type__union ssc__ts__fn__widen(ssc__core__type__union ssc__ts__var__v) {
        return ssc__ts__var__v;
      }
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__union ssc__ts__var__x) {
        if (ssc__core__fn__truthy_union(ssc__ts__var__x)) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__28209f68902f4cfe85f0f71d41805b22() {
        ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__stored = ssc__core__var__undefined;
        ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__fromU8(ssc__core__type__u8{200u}) == ssc__core__type__i32{200})) {
          (ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__orZero(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__returned(ssc__core__type__u8{100u})) == ssc__core__type__i32{100})) {
          (ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__store(ssc__core__type__u8{50u}) == ssc__core__type__i32{50})) {
          (ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__truthy(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__widen(ssc__core__type__i64{7})) == ssc__core__type__i32{1})) {
          (ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__truthy(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__fn__widen(ssc__core__var__undefined)) == ssc__core__type__i32{0})) {
          (ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::exit(ssc__ts__namespace__28209f68902f4cfe85f0f71d41805b22::ssc__ts__var__result);
      }
    }"
  `);
});

test('union.ts', async () => {
  expect(await lowerFixture('union.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02 {
      static ssc__core__type__union ssc__ts__var__last;
      static ssc__core__type__undefined ssc__ts__var__nothing;
      static ssc__core__type__i32 ssc__ts__var__result;
      static ssc__core__type__u8 ssc__ts__var__smallValue;
      static ssc__core__type__i8 ssc__ts__var__negative;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__union ssc__ts__fn__find(ssc__core__type__i32 ssc__ts__var__target);
      static ssc__core__type__i32 ssc__ts__fn__use(ssc__core__type__i32 ssc__ts__var__target);
      static ssc__core__type__i32 ssc__ts__fn__remember(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__lastOr(ssc__core__type__i32 ssc__ts__var__fallback);
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__v);
      static ssc__core__type__i32 ssc__ts__fn__small(ssc__core__type__u8 ssc__ts__var__a);
      static ssc__core__type__i64 ssc__ts__fn__next(ssc__core__type__union ssc__ts__var__v);
      static ssc__core__type__i64 ssc__ts__fn__both(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__score(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__union ssc__ts__fn__widen(ssc__core__type__union ssc__ts__var__v);
      static ssc__core__type__i32 ssc__ts__fn__orNegative(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__i32 ssc__ts__fn__kind(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__f64 ssc__ts__fn__mixed(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__undefined ssc__ts__fn__none();
      static ssc__core__type__i32 ssc__ts__fn__nullCount(ssc__core__type__null ssc__ts__var__x);
      static ssc__core__type__union ssc__ts__fn__wrap();
      static ssc__core__type__i32 ssc__ts__fn__unwrap(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__union ssc__ts__fn__find(ssc__core__type__i32 ssc__ts__var__target) {
        if ((ssc__ts__var__target > ssc__core__type__i32{10})) {
          return ssc__core__var__undefined;
        }
        return ssc__core__fn__mul(ssc__ts__var__target, ssc__core__type__i32{2}, "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__use(ssc__core__type__i32 ssc__ts__var__target) {
        const ssc__core__type__union ssc__ts__var__found = ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__find(ssc__ts__var__target);
        if (ssc__core__fn__strict_equals(ssc__ts__var__found, ssc__core__var__undefined)) {
          return ssc__core__type__i32{-1};
        }
        return ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__found), ssc__core__type__i32{1}, "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__remember(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__union ssc__ts__var__x = ssc__core__var__undefined;
        if ((ssc__ts__var__a > ssc__core__type__i32{0})) {
          (ssc__ts__var__x = ssc__ts__var__a);
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__last = ssc__ts__var__a);
        }
        if ((!ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__undefined))) {
          return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__x);
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__lastOr(ssc__core__type__i32 ssc__ts__var__fallback) {
        if (ssc__core__fn__strict_equals(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__last, ssc__core__var__undefined)) {
          return ssc__ts__var__fallback;
        }
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__last);
      }
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__v) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__v, ssc__core__var__undefined)) {
          return ssc__core__type__i32{0};
        }
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__v);
      }
      static ssc__core__type__i32 ssc__ts__fn__small(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__orZero(ssc__ts__var__a), ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__orZero(ssc__core__var__undefined), "i32"), ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__orZero(ssc__core__type__i64{300}), "i32");
      }
      static ssc__core__type__i64 ssc__ts__fn__next(ssc__core__type__union ssc__ts__var__v) {
        return ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i64>(ssc__ts__var__v), ssc__core__type__i64{1}, "i64");
      }
      static ssc__core__type__i64 ssc__ts__fn__both(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b) {
        return ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__next(ssc__ts__var__a), ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__next(ssc__ts__var__b), "i64");
      }
      static ssc__core__type__i32 ssc__ts__fn__score(ssc__core__type__union ssc__ts__var__x) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__undefined)) {
          return ssc__core__type__i32{0};
        }
        if (ssc__core__fn__string_equals(ssc__core__fn__typeof(ssc__ts__var__x), ssc__core__fn__string_literal<u8"boolean">())) {
          if (ssc__core__fn__union_to_boolean(ssc__ts__var__x)) {
            return ssc__core__type__i32{1};
          }
          return ssc__core__type__i32{2};
        }
        return ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__x), ssc__core__type__i32{10}, "i32");
      }
      static ssc__core__type__union ssc__ts__fn__widen(ssc__core__type__union ssc__ts__var__v) {
        return ssc__ts__var__v;
      }
      static ssc__core__type__i32 ssc__ts__fn__orNegative(ssc__core__type__union ssc__ts__var__x) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__null)) {
          return ssc__core__type__i32{-1};
        }
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__x);
      }
      static ssc__core__type__i32 ssc__ts__fn__kind(ssc__core__type__union ssc__ts__var__x) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__undefined)) {
          return ssc__core__type__i32{0};
        }
        if (ssc__core__fn__string_equals(ssc__core__fn__typeof(ssc__ts__var__x), ssc__core__fn__string_literal<u8"object">())) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{2};
      }
      static ssc__core__type__f64 ssc__ts__fn__mixed(ssc__core__type__union ssc__ts__var__x) {
        return (ssc__core__fn__union_to_number<ssc__core__type__f64>(ssc__ts__var__x) + ssc__core__type__f64{0.5});
      }
      static ssc__core__type__undefined ssc__ts__fn__none() {
        return ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__nothing;
      }
      static ssc__core__type__i32 ssc__ts__fn__nullCount(ssc__core__type__null ssc__ts__var__x) {
        return ssc__core__type__i32{1};
      }
      static ssc__core__type__union ssc__ts__fn__wrap() {
        const ssc__core__type__undefined ssc__ts__var__value = ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__none();
        return ssc__ts__var__value;
      }
      static ssc__core__type__i32 ssc__ts__fn__unwrap(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__union ssc__ts__var__x = ssc__core__var__null;
        if ((ssc__ts__var__a > ssc__core__type__i32{0})) {
          (ssc__ts__var__x = ssc__ts__var__a);
        }
        if (ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__null)) {
          const ssc__core__type__null ssc__ts__var__y = ssc__core__fn__union_to_null(ssc__ts__var__x);
          return ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__nullCount(ssc__ts__var__y);
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__ad87b92e9655411997eb4746c07cfd02() {
        ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__last = ssc__core__var__undefined;
        ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__nothing = ssc__core__var__undefined;
        ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__type__i32{0};
        if (((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__use(ssc__core__type__i32{3}) == ssc__core__type__i32{7}) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__use(ssc__core__type__i32{20}) == ssc__core__type__i32{-1}))) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (((((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__lastOr(ssc__core__type__i32{9}) == ssc__core__type__i32{9}) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__remember(ssc__core__type__i32{5}) == ssc__core__type__i32{5})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__remember(ssc__core__type__i32{-1}) == ssc__core__type__i32{0})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__lastOr(ssc__core__type__i32{9}) == ssc__core__type__i32{5}))) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__small(ssc__core__type__u8{7u}) == ssc__core__type__i32{307})) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__both(ssc__core__type__i32{1}, ssc__core__type__i64{10}) == ssc__core__type__i64{13})) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if (((((((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__score(ssc__core__var__undefined) == ssc__core__type__i32{0}) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__score(true) == ssc__core__type__i32{1})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__score(false) == ssc__core__type__i32{2})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__score(ssc__core__type__i64{5}) == ssc__core__type__i32{15})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__score(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__widen(ssc__core__type__i64{7})) == ssc__core__type__i32{17})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__score(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__widen(ssc__core__var__undefined)) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((((((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__orNegative(ssc__core__var__null) == ssc__core__type__i32{-1}) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__orNegative(ssc__core__type__i64{4}) == ssc__core__type__i32{4})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__kind(ssc__core__var__undefined) == ssc__core__type__i32{0})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__kind(ssc__core__var__null) == ssc__core__type__i32{1})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__kind(ssc__core__type__i64{7}) == ssc__core__type__i32{2}))) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__smallValue = ssc__core__type__u8{2u};
        ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__negative = ssc__core__type__i8{-3};
        if ((((ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__mixed(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__smallValue) == ssc__core__type__f64{2.5}) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__mixed(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__negative) == ssc__core__type__f64{-2.5})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__mixed(ssc__core__type__f64{1.5}) == ssc__core__type__f64{2.0}))) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        if ((((ssc__core__fn__strict_equals(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__wrap(), ssc__core__var__undefined) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__nullCount(ssc__core__var__null) == ssc__core__type__i32{1})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__unwrap(ssc__core__type__i32{-1}) == ssc__core__type__i32{1})) && (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__fn__unwrap(ssc__core__type__i32{1}) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result, ssc__core__type__i32{128}, "i32"));
        }
        ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::exit(ssc__ts__namespace__ad87b92e9655411997eb4746c07cfd02::ssc__ts__var__result);
      }
    }"
  `);
});

test('string.ts', async () => {
  expect(await lowerFixture('string.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3 {
      static ssc__core__type__ref ssc__ts__var__top;
      static ssc__core__type__u64 ssc__ts__var__topLength;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__u64 ssc__ts__fn__length(ssc__core__type__ref ssc__ts__var__s);
      static ssc__core__type__boolean ssc__ts__fn__equals(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__differs(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__less(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__lessOrEqual(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__greater(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__greaterOrEqual(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__ref ssc__ts__fn__orEmpty(ssc__core__type__union ssc__ts__var__s);
      static ssc__core__type__i32 ssc__ts__fn__kind(ssc__core__type__union ssc__ts__var__v);
      static ssc__core__type__ref ssc__ts__fn__join(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b);
      static ssc__core__type__ref ssc__ts__fn__withChar(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__char ssc__ts__var__c);
      static ssc__core__type__ref ssc__ts__fn__append(ssc__core__type__ref ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__ref ssc__ts__var__s);
      static ssc__core__type__u64 ssc__ts__fn__length(ssc__core__type__ref ssc__ts__var__s) {
        return ssc__core__fn__string_length(ssc__ts__var__s);
      }
      static ssc__core__type__boolean ssc__ts__fn__equals(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return ssc__core__fn__string_equals(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__boolean ssc__ts__fn__differs(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return (!ssc__core__fn__string_equals(ssc__ts__var__a, ssc__ts__var__b));
      }
      static ssc__core__type__boolean ssc__ts__fn__less(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return (ssc__core__fn__string_compare(ssc__ts__var__a, ssc__ts__var__b) < 0);
      }
      static ssc__core__type__boolean ssc__ts__fn__lessOrEqual(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return (ssc__core__fn__string_compare(ssc__ts__var__a, ssc__ts__var__b) <= 0);
      }
      static ssc__core__type__boolean ssc__ts__fn__greater(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return (ssc__core__fn__string_compare(ssc__ts__var__a, ssc__ts__var__b) > 0);
      }
      static ssc__core__type__boolean ssc__ts__fn__greaterOrEqual(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return (ssc__core__fn__string_compare(ssc__ts__var__a, ssc__ts__var__b) >= 0);
      }
      static ssc__core__type__ref ssc__ts__fn__orEmpty(ssc__core__type__union ssc__ts__var__s) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__s, ssc__core__var__undefined)) {
          return ssc__core__fn__string_literal<u8"">();
        }
        return ssc__core__fn__union_to_ref(ssc__ts__var__s);
      }
      static ssc__core__type__i32 ssc__ts__fn__kind(ssc__core__type__union ssc__ts__var__v) {
        if ((ssc__core__fn__string_equals(ssc__core__fn__typeof(ssc__ts__var__v), ssc__core__fn__string_literal<u8"string">()) && (ssc__core__fn__string_length(ssc__core__fn__union_to_ref(ssc__ts__var__v)) == ssc__core__type__u64{2u}))) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{2};
      }
      static ssc__core__type__ref ssc__ts__fn__join(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return ssc__core__fn__string_concat(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__ref ssc__ts__fn__withChar(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__char ssc__ts__var__c) {
        return ssc__core__fn__string_concat(ssc__ts__var__a, ssc__core__fn__string_from_char(ssc__ts__var__c));
      }
      static ssc__core__type__ref ssc__ts__fn__append(ssc__core__type__ref ssc__ts__var__a) {
        ssc__core__type__ref ssc__ts__var__s = ssc__ts__var__a;
        (ssc__ts__var__s = ssc__core__fn__string_concat(ssc__ts__var__s, ssc__core__fn__string_from_char(ssc__core__type__char{33u})));
        return ssc__ts__var__s;
      }
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__ref ssc__ts__var__s) {
        if (ssc__core__fn__string_length(ssc__ts__var__s) != 0) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__2c710c7ccb114edea26e1543756c02f3() {
        ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__top = ssc__core__fn__string_literal<u8"abc">();
        ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__topLength = ssc__core__fn__string_length(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__top);
        ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__type__i32{0};
        if (((((ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"hello">()) == ssc__core__type__u64{5u}) && (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"\\355\\225\\234\\352\\270\\200">()) == ssc__core__type__u64{6u})) && (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"\\360\\237\\221\\215">()) == ssc__core__type__u64{4u})) && (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"">()) == ssc__core__type__u64{0u}))) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__topLength == ssc__core__type__u64{3u})) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (((((((ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"abc">(), ssc__core__fn__string_literal<u8"abc">()) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"">(), ssc__core__fn__string_literal<u8"">())) && (!(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"abc">(), ssc__core__fn__string_literal<u8"abd">())))) && (!(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"ab">(), ssc__core__fn__string_literal<u8"abc">())))) && (!(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"a\\000b">(), ssc__core__fn__string_literal<u8"a\\000c">())))) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__differs(ssc__core__fn__string_literal<u8"\\355\\225\\234">(), ssc__core__fn__string_literal<u8"\\352\\270\\200">())) && (!(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__differs(ssc__core__fn__string_literal<u8"\\360\\237\\221\\215">(), ssc__core__fn__string_literal<u8"\\360\\237\\221\\215">()))))) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((((((((((ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"b">()) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"ab">(), ssc__core__fn__string_literal<u8"abc">())) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"">(), ssc__core__fn__string_literal<u8"a">())) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"B">(), ssc__core__fn__string_literal<u8"a">())) && (!(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"a">())))) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__lessOrEqual(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"a">())) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__greater(ssc__core__fn__string_literal<u8"\\355\\225\\234">(), ssc__core__fn__string_literal<u8"z">())) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__greaterOrEqual(ssc__core__fn__string_literal<u8"b">(), ssc__core__fn__string_literal<u8"a">())) && (!(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__greaterOrEqual(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"b">())))) && ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"\\357\\277\\277">(), ssc__core__fn__string_literal<u8"\\360\\237\\230\\200">()))) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((((ssc__core__fn__string_equals(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__orEmpty(ssc__core__fn__string_literal<u8"hi">()), ssc__core__fn__string_literal<u8"hi">()) && ssc__core__fn__string_equals(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__orEmpty(ssc__core__var__undefined), ssc__core__fn__string_literal<u8"">())) && (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__kind(ssc__core__fn__string_literal<u8"ab">()) == ssc__core__type__i32{1})) && (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__kind(ssc__core__type__i64{7}) == ssc__core__type__i32{2}))) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (((ssc__core__fn__string_equals(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__join(ssc__core__fn__string_literal<u8"ab">(), ssc__core__fn__string_literal<u8"cd">()), ssc__core__fn__string_literal<u8"abcd">()) && ssc__core__fn__string_equals(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__withChar(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__char(ssc__core__type__u32{128077u})), ssc__core__fn__string_literal<u8"a\\360\\237\\221\\215">())) && ssc__core__fn__string_equals(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__append(ssc__core__fn__string_literal<u8"hi">()), ssc__core__fn__string_literal<u8"hi!">()))) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if (((ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__truthy(ssc__core__fn__string_literal<u8"x">()) == ssc__core__type__i32{1}) && (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__fn__truthy(ssc__core__fn__string_literal<u8"">()) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::exit(ssc__ts__namespace__2c710c7ccb114edea26e1543756c02f3::ssc__ts__var__result);
      }
    }"
  `);
});

test('equality.ts', async () => {
  expect(await lowerFixture('equality.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f {
      static ssc__core__type__u64 ssc__ts__var__big;
      static ssc__core__type__i64 ssc__ts__var__minus;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__boolean ssc__ts__fn__isFive(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__boolean ssc__ts__fn__isHi(ssc__core__type__union ssc__ts__var__s);
      static ssc__core__type__boolean ssc__ts__fn__same(ssc__core__type__union ssc__ts__var__a, ssc__core__type__union ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__isTrue(ssc__core__type__union ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__isA(ssc__core__type__union ssc__ts__var__c);
      static ssc__core__type__boolean ssc__ts__fn__isTwo(ssc__core__type__union ssc__ts__var__x);
      static ssc__core__type__boolean ssc__ts__fn__isFive(ssc__core__type__union ssc__ts__var__x) {
        return ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__type__f64{5.0});
      }
      static ssc__core__type__boolean ssc__ts__fn__isHi(ssc__core__type__union ssc__ts__var__s) {
        return ssc__core__fn__strict_equals(ssc__ts__var__s, ssc__core__fn__string_literal<u8"hi">());
      }
      static ssc__core__type__boolean ssc__ts__fn__same(ssc__core__type__union ssc__ts__var__a, ssc__core__type__union ssc__ts__var__b) {
        return ssc__core__fn__strict_equals(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__boolean ssc__ts__fn__isTrue(ssc__core__type__union ssc__ts__var__b) {
        return ssc__core__fn__strict_equals(ssc__ts__var__b, true);
      }
      static ssc__core__type__boolean ssc__ts__fn__isA(ssc__core__type__union ssc__ts__var__c) {
        return ssc__core__fn__strict_equals(ssc__ts__var__c, ssc__core__type__char{65u});
      }
      static ssc__core__type__boolean ssc__ts__fn__isTwo(ssc__core__type__union ssc__ts__var__x) {
        return ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__type__f64{2.0});
      }
      void ssc__core__fn__867acf107e7c422c873556f5b5d3200f() {
        ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__big = ssc__core__type__u64{18446744073709551615u};
        ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__minus = ssc__core__type__i64{-1};
        ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__type__i32{0};
        if (((ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isFive(ssc__core__type__i64{5}) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isFive(ssc__core__type__i64{6})))) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isFive(ssc__core__var__undefined))))) {
          (ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (((ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isHi(ssc__core__fn__string_literal<u8"hi">()) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isHi(ssc__core__fn__string_literal<u8"ho">())))) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isHi(ssc__core__var__undefined))))) {
          (ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (((ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__same(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__minus, ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__minus) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__same(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__minus, ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__big)))) && ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__same(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__big, ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__big))) {
          (ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (((ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isTrue(true) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isTrue(false)))) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isTrue(ssc__core__var__undefined))))) {
          (ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if (((ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isA(ssc__core__fn__char(ssc__core__type__u32{65u})) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isA(ssc__core__fn__char(ssc__core__type__u32{66u}))))) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isA(ssc__core__var__undefined))))) {
          (ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (((ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isTwo(ssc__core__type__i64{2}) && ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isTwo(ssc__core__type__i64{2})) && (!(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__fn__isTwo(ssc__core__type__f64{2.5}))))) {
          (ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::exit(ssc__ts__namespace__867acf107e7c422c873556f5b5d3200f::ssc__ts__var__result);
      }
    }"
  `);
});

test('numeric.ts', async () => {
  expect(await lowerFixture('numeric.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5 {
      static ssc__core__type__f64 ssc__ts__var__half;
      static ssc__core__type__f64 ssc__ts__var__big;
      static ssc__core__type__f32 ssc__ts__var__small;
      static ssc__core__type__f64 ssc__ts__var__overflow;
      static ssc__core__type__f64 ssc__ts__var__underflow;
      static ssc__core__type__f32 ssc__ts__var__overflow32;
      static ssc__core__type__i32 ssc__ts__var__exponent;
      static ssc__core__type__f32 ssc__ts__var__negative;
      static ssc__core__type__i32 ssc__ts__var__fromUnderflow;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__twice(ssc__core__type__i32 ssc__ts__var__v);
      static ssc__core__type__boolean ssc__ts__fn__u8s(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__i32s(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__minimumRemainder(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__twice(ssc__core__type__i32 ssc__ts__var__v) {
        return ssc__core__fn__add(ssc__ts__var__v, ssc__ts__var__v, "i32");
      }
      static ssc__core__type__boolean ssc__ts__fn__u8s(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return (((ssc__core__fn__add(ssc__ts__var__a, ssc__ts__var__b, "u8") == ssc__core__type__u8{255u}) && (ssc__core__fn__sub(ssc__ts__var__a, ssc__ts__var__b, "u8") == ssc__core__type__u8{145u})) && (ssc__core__fn__mul(ssc__ts__var__a, ssc__core__type__u8{1u}, "u8") == ssc__core__type__u8{200u}));
      }
      static ssc__core__type__boolean ssc__ts__fn__i32s(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return ((ssc__core__fn__div(ssc__ts__var__a, ssc__ts__var__b, "i32") == ssc__core__type__i32{-2}) && (ssc__core__fn__rem(ssc__ts__var__a, ssc__ts__var__b, "i32") == ssc__core__type__i32{-1}));
      }
      static ssc__core__type__i32 ssc__ts__fn__minimumRemainder(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return ssc__core__fn__rem(ssc__ts__var__a, ssc__ts__var__b, "i32");
      }
      void ssc__core__fn__454b33a2054c4d1ea5e5fdbc8aa165b5() {
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__half = (ssc__core__type__f64{1.0} / ssc__core__type__f64{2.0});
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__big = ssc__core__type__f64{100000000000000000000.0};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__small = ssc__core__type__f32{0.1f};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__overflow = ssc__core__type__f64{__builtin_inf()};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__underflow = ssc__core__type__f64{0.0};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__overflow32 = ssc__core__type__f32{__builtin_inff()};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__exponent = ssc__core__type__i32{1000};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__negative = ssc__core__type__f32{-1.5f};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__fromUnderflow = ssc__core__type__i32{0};
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__half == ssc__core__type__f64{0.5})) {
          (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__fn__twice(ssc__core__type__i32{21}) == ssc__core__type__i32{42})) {
          (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (((ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__fn__u8s(ssc__core__type__u8{200u}, ssc__core__type__u8{55u}) && ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__fn__i32s(ssc__core__type__i32{-5}, ssc__core__type__i32{2})) && (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__fn__minimumRemainder(ssc__core__type__i32{-2147483648}, ssc__core__type__i32{-1}) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (((((((((static_cast<ssc__core__type__f64>(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__big) == ssc__core__type__f64{100000000000000000000.0}) && (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__small == ssc__core__type__f32{0.1f})) && (static_cast<ssc__core__type__f64>(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__overflow) > ssc__core__type__f64{100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000.0})) && (static_cast<ssc__core__type__f64>(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__underflow) == ssc__core__type__f64{0.0})) && (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__overflow32 > ssc__core__type__f32{100000000000000000000000000000000000000.0f})) && (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__exponent == ssc__core__type__i32{1000})) && (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__negative == ssc__core__type__f32{-1.5f})) && (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__fromUnderflow == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::exit(ssc__ts__namespace__454b33a2054c4d1ea5e5fdbc8aa165b5::ssc__ts__var__result);
      }
    }"
  `);
});

test('reserved.ts', async () => {
  await expect(lowerFixture('reserved.ts')).rejects.toThrow("'ssc__fn__truthy_f64' is reserved");
});

test('shadow-name.ts', async () => {
  await expect(lowerFixture('shadow-name.ts')).rejects.toThrow('not implemented type');
});

test('shadow-brand.ts', async () => {
  await expect(lowerFixture('shadow-brand.ts')).rejects.toThrow("'i8' is not the prelude type");
});
