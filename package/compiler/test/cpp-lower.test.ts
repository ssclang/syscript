import { assert } from '@syscript/share/util';
import cp from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { lower } from '~/cpp/lower.js';
import { SscBuildManager } from '~/ssc/manager/build.js';
import { SscManager } from '~/ssc/manager/ssc.js';
import { PathResolver } from '~/util/path-resolver.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

async function lowerFixture(name: string) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const idJsonPath = path.join(import.meta.dirname, 'id.json');
    const manager = await SscManager.init({ outDir, profile: 'test', idJsonPath });
    const { modules } = await manager.buildManager.compile(path.join(fixtureDir, name));
    const module = modules.at(-1);

    assert(module);

    const output = lower(module.sourceFile, (path) => manager.idManager.loadId(path)).render();

    await manager.flush();
    await compileCpp(outDir, output);

    return output;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

async function compileCpp(dir: string, code: string) {
  const clang = PathResolver.clangPath();
  const flags = SscBuildManager.clangCompileFlag();
  const preludeCppmPath = PathResolver.preludeCppmPath();
  const sscPcmPath = path.join(dir, 'ssc.pcm');
  const tsCppmPath = path.join(dir, 'ts.cppm');
  const tsPcmPath = path.join(dir, 'ts.pcm');
  const cppPath = path.join(dir, 'file.cpp');
  const moduleFlags = [`-fmodule-file=ssc=${sscPcmPath}`, `-fmodule-file=ts=${tsPcmPath}`];

  await fs.writeFile(tsCppmPath, 'export module ts;\n');
  await fs.writeFile(cppPath, code);

  cp.execFileSync(clang, [...flags, '--precompile', preludeCppmPath, '-o', sscPcmPath]);
  cp.execFileSync(clang, [...flags, '--precompile', tsCppmPath, '-o', tsPcmPath]);
  cp.execFileSync(clang, [...flags, ...moduleFlags, '-c', cppPath, '-o', path.join(dir, 'file.o')]);
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
