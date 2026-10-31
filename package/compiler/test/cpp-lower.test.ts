import { assert } from '@syscript/share/util';
import cp from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { lower } from '~/cpp/lower.js';
import { analyzeClosure } from '~/cpp/closure.js';
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
    const { boxedVariableSymbolIdSet, closureCaptureMap } = analyzeClosure(sourceFiles);
    const output = lower(module.sourceFile, {
      kind: 'program',
      pathToId: (path) => manager.idManager.loadId(path),
      topLevelVariableSymbolIdSet,
      tdzVariableSymbolIdSet,
      tdzReferenceNodeSet,
      boxedVariableSymbolIdSet,
      closureCaptureMap,
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

    namespace ssc__ts__namespace__50c31cf884ce4b56a7eed410f01283b7 {
      extern "C" ssc__core__type__i32 abs(ssc__core__type__i32 ssc__ts__var__x);
      ssc__core__type__i32 ssc__ts__fn__add(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
    }

    namespace ssc__ts__namespace__c456d5b4cd564961a9f46c7eef225ca6 {
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__status);
    }

    namespace ssc__ts__namespace__57d2373578f744bc847a72c32b933972 {
      void ssc__core__fn__57d2373578f744bc847a72c32b933972() {
        ssc__ts__namespace__c456d5b4cd564961a9f46c7eef225ca6::exit(ssc__ts__namespace__50c31cf884ce4b56a7eed410f01283b7::ssc__ts__fn__add(ssc__ts__namespace__50c31cf884ce4b56a7eed410f01283b7::abs(ssc__core__type__i32{3}), ssc__core__type__i32{4}));
      }
    }"
  `);
});

test('function.ts', async () => {
  expect(await lowerFixture('function.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__29254185632d4dbdbb0df860ab1cca3d {
      static ssc__core__type__void ssc__ts__fn__noop1();
      static ssc__core__type__void ssc__ts__fn__noop2();
      static ssc__core__type__i32 ssc__ts__fn__noop3();
      static ssc__core__type__i32 ssc__ts__fn__noop4();
      static ssc__core__type__f64 ssc__ts__fn__noop5();
      static ssc__core__type__f64 ssc__ts__fn__noop6();
      static ssc__core__type__f32 ssc__ts__fn__noop7();
      static ssc__core__type__void ssc__ts__fn__noop8(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__noop9(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__f64 ssc__ts__var__b);
      static ssc__core__type__void ssc__ts__fn__noop10(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b, ssc__core__type__f32 ssc__ts__var__c);
      static ssc__core__type__i64 ssc__ts__fn__noop11(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b);
      static ssc__core__type__i64 ssc__ts__fn__noop12();
      extern "C" ssc__core__type__i32 abs(ssc__core__type__i32 ssc__ts__var__x);
      static ssc__core__type__i32 ssc__ts__fn__noop13();
      ssc__core__type__void ssc__ts__fn__noop14();
      static ssc__core__type__i32 ssc__ts__fn__noop15();
      static ssc__core__type__i32 ssc__ts__fn__noop16();
      static ssc__core__type__void ssc__ts__fn__noop1() {
      }
      static ssc__core__type__void ssc__ts__fn__noop2() {
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
      static ssc__core__type__void ssc__ts__fn__noop8(ssc__core__type__i32 ssc__ts__var__a) {
      }
      static ssc__core__type__i32 ssc__ts__fn__noop9(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__f64 ssc__ts__var__b) {
        return ssc__core__type__i32{1};
      }
      static ssc__core__type__void ssc__ts__fn__noop10(ssc__core__type__u8 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b, ssc__core__type__f32 ssc__ts__var__c) {
        return;
      }
      static ssc__core__type__i64 ssc__ts__fn__noop11(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b) {
        return ssc__core__fn__add(static_cast<ssc__core__type__i64>(ssc__ts__var__a), ssc__ts__var__b, "i64");
      }
      static ssc__core__type__i64 ssc__ts__fn__noop12() {
        return ssc__ts__namespace__29254185632d4dbdbb0df860ab1cca3d::ssc__ts__fn__noop11(ssc__core__type__i32{3}, ssc__core__type__i64{4});
      }
      static ssc__core__type__i32 ssc__ts__fn__noop13() {
        return ssc__ts__namespace__29254185632d4dbdbb0df860ab1cca3d::abs(ssc__core__type__i32{5});
      }
      ssc__core__type__void ssc__ts__fn__noop14() {
      }
      static ssc__core__type__i32 ssc__ts__fn__noop15() {
        return ssc__ts__namespace__29254185632d4dbdbb0df860ab1cca3d::ssc__ts__fn__noop16();
      }
      static ssc__core__type__i32 ssc__ts__fn__noop16() {
        return ssc__core__type__i32{1};
      }
      void ssc__core__fn__29254185632d4dbdbb0df860ab1cca3d() {
        ssc__ts__namespace__29254185632d4dbdbb0df860ab1cca3d::ssc__ts__fn__noop13();
      }
    }"
  `);
});

test('if.ts', async () => {
  expect(await lowerFixture('if.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__9870639fb15b4978ad74e93d5714944c {
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b, ssc__core__type__u8 ssc__ts__var__c, ssc__core__type__f64 ssc__ts__var__d, ssc__core__type__f32 ssc__ts__var__e);
      static ssc__core__type__i32 ssc__ts__fn__literal();
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__character(ssc__core__type__char ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b, ssc__core__type__u8 ssc__ts__var__c, ssc__core__type__f64 ssc__ts__var__d, ssc__core__type__f32 ssc__ts__var__e) {
        if (ssc__ts__var__a) {
          return ssc__core__type__i32{1};
        } else if ((ssc__ts__var__b != 0)) {
          return ssc__core__type__i32{2};
        } else if ((ssc__ts__var__c != 0)) {
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
        return ssc__core__fn__add(ssc__ts__var__b, ssc__core__fn__add(ssc__ts__var__b, ssc__ts__var__b, "i32"), "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__character(ssc__core__type__char ssc__ts__var__a) {
        if ((ssc__ts__var__a != 0)) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__9870639fb15b4978ad74e93d5714944c() {
      }
    }"
  `);
});

test('if-union.ts', async () => {
  expect(await lowerFixture('if-union.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__e4644744181443f4923e66bfa897d061 {
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
        return ssc__ts__namespace__e4644744181443f4923e66bfa897d061::ssc__ts__fn__truthy(ssc__ts__var__a, ssc__core__var__null, ssc__core__var__undefined);
      }
      static ssc__core__type__i32 ssc__ts__fn__sized(ssc__core__type__union ssc__ts__var__a) {
        if (ssc__core__fn__truthy_union(ssc__ts__var__a)) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__literal() {
        return ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__e4644744181443f4923e66bfa897d061::ssc__ts__fn__truthy(ssc__core__type__i32{3}, ssc__core__type__f64{2.5}, ssc__core__var__undefined), ssc__ts__namespace__e4644744181443f4923e66bfa897d061::ssc__ts__fn__sized(ssc__core__type__i64{3}), "i32"), ssc__ts__namespace__e4644744181443f4923e66bfa897d061::ssc__ts__fn__sized(ssc__core__type__i64{300}), "i32");
      }
      void ssc__core__fn__e4644744181443f4923e66bfa897d061() {
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

    namespace ssc__ts__namespace__6cfff2ad46c240e8be9142c98526a982 {
      static ssc__core__type__i32 ssc__ts__fn__variables(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__variables(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__b = ssc__ts__var__a;
        const ssc__core__type__i32 ssc__ts__var__c = ssc__core__type__i32{2};
        ssc__core__type__i32 ssc__ts__var__d;
        (ssc__ts__var__d = ssc__core__fn__add(ssc__ts__var__b, ssc__ts__var__c, "i32"));
        (ssc__ts__var__b = ssc__core__type__i32{10});
        const ssc__core__type__union ssc__ts__var__e = ssc__core__type__i32{3};
        if ((ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__e) != 0)) {
          const ssc__core__type__i32 ssc__ts__var__c = ssc__core__type__i32{100};
          (ssc__ts__var__d = ssc__core__fn__add(ssc__ts__var__d, ssc__ts__var__c, "i32"));
        }
        return ssc__core__fn__add(ssc__ts__var__d, ssc__ts__var__b, "i32");
      }
      void ssc__core__fn__6cfff2ad46c240e8be9142c98526a982() {
      }
    }"
  `);
});

test('top-level-variable.ts', async () => {
  expect(await lowerFixture('top-level-variable.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792 {
      static ssc__core__type__i32 ssc__ts__var__total;
      static ssc__core__type__i32 ssc__ts__var__step;
      static ssc__core__type__i32 ssc__ts__var__later;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__void ssc__ts__fn__add(ssc__core__type__i32 ssc__ts__var__n);
      static ssc__core__type__void ssc__ts__fn__add(ssc__core__type__i32 ssc__ts__var__n) {
        (ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__total = ssc__core__fn__add(ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__total, ssc__ts__var__n, "i32"));
      }
      void ssc__core__fn__654cf73b67494900aa5601b67e1e4792() {
        ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__total = ssc__core__type__i32{1};
        ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__step = ssc__core__type__i32{2};
        ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__fn__add(ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__step);
        (ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__later = ssc__core__fn__add(ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__total, ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__step, "i32"));
        ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__fn__add(ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__later);
        ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::exit(ssc__ts__namespace__654cf73b67494900aa5601b67e1e4792::ssc__ts__var__total);
      }
    }"
  `);
});

test('top-level-import.ts', async () => {
  expect(await lowerFixture('top-level-import.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70 {
      ssc__core__type__void ssc__ts__fn__increase(ssc__core__type__i32 ssc__ts__var__n);
      extern ssc__core__type__i32 ssc__ts__var__count;
    }

    namespace ssc__ts__namespace__ddee6b61e35c4860959aebec5ed03fa3 {
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__ddee6b61e35c4860959aebec5ed03fa3() {
        ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70::ssc__ts__fn__increase(ssc__core__type__i32{3});
        ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70::ssc__ts__fn__increase(ssc__core__type__i32{4});
        ssc__ts__namespace__ddee6b61e35c4860959aebec5ed03fa3::exit(ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70::ssc__ts__var__count);
      }
    }"
  `);
});

test('top-level-rename.ts', async () => {
  expect(await lowerFixture('top-level-rename.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70 {
      ssc__core__type__void ssc__ts__fn__increase(ssc__core__type__i32 ssc__ts__var__n);
      extern ssc__core__type__i32 ssc__ts__var__count;
    }

    namespace ssc__ts__namespace__8352f580dfad49fc88300ba2e38411e2 {
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__8352f580dfad49fc88300ba2e38411e2() {
        ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70::ssc__ts__fn__increase(ssc__core__type__i32{5});
        ssc__ts__namespace__8352f580dfad49fc88300ba2e38411e2::exit(ssc__ts__namespace__f6039c360aa04e0cb574493e78682e70::ssc__ts__var__count);
      }
    }"
  `);
});

test('tdz-function.ts', async () => {
  expect(await lowerFixture('tdz-function.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d {
      static ssc__core__type__i32 ssc__ts__var__value;
      static ssc__core__type__boolean ssc__ts__tdz__value;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__read();
      static ssc__core__type__i32 ssc__ts__fn__read() {
        return (ssc__core__fn__throw_if_tdz(ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d::ssc__ts__tdz__value, "value") , ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d::ssc__ts__var__value);
      }
      void ssc__core__fn__2b5ab7f93a274e82999ad7801d747f5d() {
        ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d::exit(ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d::ssc__ts__fn__read());
        ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d::ssc__ts__var__value = ssc__core__type__i32{7};
        ssc__ts__namespace__2b5ab7f93a274e82999ad7801d747f5d::ssc__ts__tdz__value = true;
      }
    }"
  `);
});

test('tdz-cycle.ts', async () => {
  expect(await lowerFixture('tdz-cycle.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__b3119b0297374b4b8ddd4f0f9d33d50c {
      extern ssc__core__type__i32 ssc__ts__var__libValue;
    }

    namespace ssc__ts__namespace__e8d5a4ede16b43388a609f5053d5cea4 {
      ssc__core__type__i32 ssc__ts__var__value;
      ssc__core__type__boolean ssc__ts__tdz__value;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      ssc__core__type__i32 ssc__ts__fn__readValue();
      ssc__core__type__i32 ssc__ts__fn__readValue() {
        return (ssc__core__fn__throw_if_tdz(ssc__ts__namespace__e8d5a4ede16b43388a609f5053d5cea4::ssc__ts__tdz__value, "value") , ssc__ts__namespace__e8d5a4ede16b43388a609f5053d5cea4::ssc__ts__var__value);
      }
      void ssc__core__fn__e8d5a4ede16b43388a609f5053d5cea4() {
        ssc__ts__namespace__e8d5a4ede16b43388a609f5053d5cea4::ssc__ts__var__value = ssc__core__type__i32{7};
        ssc__ts__namespace__e8d5a4ede16b43388a609f5053d5cea4::ssc__ts__tdz__value = true;
        ssc__ts__namespace__e8d5a4ede16b43388a609f5053d5cea4::exit(ssc__ts__namespace__b3119b0297374b4b8ddd4f0f9d33d50c::ssc__ts__var__libValue);
      }
    }"
  `);
});

test('tdz-reference.ts', async () => {
  expect(await lowerFixture('tdz-reference.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__9e9ac416768c49698863dec01c63708c {
      static ssc__core__type__boolean ssc__ts__var__run;
      static ssc__core__type__i32 ssc__ts__var__value;
      static ssc__core__type__boolean ssc__ts__tdz__value;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__early();
      static ssc__core__type__i32 ssc__ts__fn__late();
      static ssc__core__type__i32 ssc__ts__fn__early() {
        return (ssc__core__fn__throw_if_tdz(ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__tdz__value, "value") , ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__var__value);
      }
      static ssc__core__type__i32 ssc__ts__fn__late() {
        return ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__var__value;
      }
      void ssc__core__fn__9e9ac416768c49698863dec01c63708c() {
        ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__var__run = false;
        if (ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__var__run) {
          ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::exit(ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__fn__early());
        }
        ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__var__value = ssc__core__type__i32{7};
        ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__tdz__value = true;
        ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::exit(ssc__ts__namespace__9e9ac416768c49698863dec01c63708c::ssc__ts__fn__late());
      }
    }"
  `);
});

test('tdz-extern.ts', async () => {
  expect(await lowerFixture('tdz-extern.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__e3d81720d32d43cfa1956ae9123fa63f {
      extern ssc__core__type__i32 ssc__ts__var__value;
    }

    namespace ssc__ts__namespace__23d30bdf603342d098b9bdf50c13e1fc {
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__23d30bdf603342d098b9bdf50c13e1fc() {
        ssc__ts__namespace__23d30bdf603342d098b9bdf50c13e1fc::exit(ssc__ts__namespace__e3d81720d32d43cfa1956ae9123fa63f::ssc__ts__var__value);
      }
    }"
  `);
});

test('arithmetic.ts', async () => {
  expect(await lowerFixture('arithmetic.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__db7cc51ce18345c3b2b1849f5e8d68a9 {
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__integer(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__f64 ssc__ts__fn__float(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__f32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__integer(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return ssc__core__fn__rem(ssc__core__fn__div(ssc__core__fn__sub(ssc__core__fn__mul(ssc__ts__var__a, ssc__core__type__i32{3}, "i32"), static_cast<ssc__core__type__i32>(ssc__ts__var__b), "i32"), ssc__core__type__i32{2}, "i32"), ssc__core__type__i32{100}, "i32");
      }
      static ssc__core__type__f64 ssc__ts__fn__float(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__f32 ssc__ts__var__b) {
        return __builtin_fmod((((ssc__ts__var__a * ssc__core__type__f64{3.0}) - static_cast<ssc__core__type__f64>(ssc__ts__var__b)) / ssc__core__type__f64{2.0}), ssc__core__type__f64{100.0});
      }
      void ssc__core__fn__db7cc51ce18345c3b2b1849f5e8d68a9() {
        ssc__ts__namespace__db7cc51ce18345c3b2b1849f5e8d68a9::ssc__ts__fn__float(ssc__core__type__f64{1.0}, ssc__core__type__f32{2.0f});
        ssc__ts__namespace__db7cc51ce18345c3b2b1849f5e8d68a9::exit(ssc__ts__namespace__db7cc51ce18345c3b2b1849f5e8d68a9::ssc__ts__fn__integer(ssc__core__type__i32{20}, ssc__core__type__u8{4u}));
      }
    }"
  `);
});

test('comparison.ts', async () => {
  expect(await lowerFixture('comparison.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab {
      static ssc__core__type__i32 ssc__ts__var__zero;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
        return ((!(ssc__ts__var__a == ssc__ts__var__b)) == ssc__ts__var__c);
      }
      void ssc__core__fn__625589c09a9949f3b411e8444bd154ab() {
        ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__zero = ssc__core__type__i32{0};
        ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__type__i32{0};
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__less(ssc__core__fn__sub(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__zero, ssc__core__type__i32{1}, "i32"), ssc__core__type__u32{4000000000u})) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__lessEqual(ssc__core__type__u8{3u}, ssc__core__type__u8{3u})) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__greater(ssc__core__type__u64{5u}, ssc__core__type__u8{3u})) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__greaterEqual(ssc__core__type__i16{3}, ssc__core__type__i16{4})) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__equal(ssc__core__type__f64{0.5}, ssc__core__type__f32{0.5f})) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__notEqual(ssc__core__type__i32{1}, ssc__core__type__i64{2})) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__fn__sameBoolean(true, false, true)) {
          (ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::exit(ssc__ts__namespace__625589c09a9949f3b411e8444bd154ab::ssc__ts__var__result);
      }
    }"
  `);
});

test('literal-type.ts', async () => {
  expect(await lowerFixture('literal-type.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__28949e895eb34893875d3030db111b2e {
      static ssc__core__type__f64 ssc__ts__var__five;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__constant(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__assignment(ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__u64 ssc__ts__fn__exact(ssc__core__type__u64 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__parenthesized(ssc__core__type__i32 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__ts__var__a, ssc__core__type__i32{5}, "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__constant(ssc__core__type__i32 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__ts__var__a, static_cast<ssc__core__type__i32>(ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__var__five), "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__assignment(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__i32 ssc__ts__var__b = ssc__core__type__i32{0};
        const ssc__core__type__i32 ssc__ts__var__c = ssc__core__fn__add(ssc__ts__var__a, static_cast<ssc__core__type__i32>((ssc__ts__var__b = ssc__core__type__i32{5})), "i32");
        return ssc__core__fn__add(ssc__ts__var__c, ssc__ts__var__b, "i32");
      }
      static ssc__core__type__u64 ssc__ts__fn__exact(ssc__core__type__u64 ssc__ts__var__a) {
        return ssc__core__fn__sub(ssc__ts__var__a, ssc__core__type__u64{9007199254740993u}, "u64");
      }
      void ssc__core__fn__28949e895eb34893875d3030db111b2e() {
        ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__var__five = ssc__core__type__f64{5.0};
        ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__var__result = ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__fn__parenthesized(ssc__core__type__i32{1}), ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__fn__constant(ssc__core__type__i32{1}), "i32"), ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__fn__assignment(ssc__core__type__i32{1}), "i32");
        if ((ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__fn__exact(ssc__core__type__u64{9007199254740995u}) == ssc__core__type__u64{2u})) {
          (ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__var__result, ssc__core__type__i32{100}, "i32"));
        }
        ssc__ts__namespace__28949e895eb34893875d3030db111b2e::exit(ssc__ts__namespace__28949e895eb34893875d3030db111b2e::ssc__ts__var__result);
      }
    }"
  `);
});

test('bitwise.ts', async () => {
  expect(await lowerFixture('bitwise.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc {
      static ssc__core__type__i32 ssc__ts__var__zero;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__0c20efdbea734ed1acb26d93d7ed16fc() {
        ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__zero = ssc__core__type__i32{0};
        ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__fn__and(ssc__core__type__u8{12u}, ssc__core__type__u8{10u}) == ssc__core__type__u8{8u})) {
          (ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__fn__or(ssc__core__type__i32{16}, ssc__core__type__u8{3u}) == ssc__core__type__i32{19})) {
          (ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__fn__xor(ssc__core__type__u16{5u}, ssc__core__type__u16{3u}) == ssc__core__type__u16{6u})) {
          (ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__fn__shiftLeft(ssc__core__type__u8{200u}, ssc__core__type__u8{1u}) == ssc__core__type__u8{144u})) {
          (ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__fn__shiftRight(ssc__core__fn__sub(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__zero, ssc__core__type__i32{8}, "i32"), ssc__core__type__i32{1}) == ssc__core__fn__sub(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__zero, ssc__core__type__i32{4}, "i32"))) {
          (ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__fn__unsignedShiftRight(ssc__core__fn__sub(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__zero, ssc__core__type__i32{1}, "i32"), ssc__core__type__i32{1}) == ssc__core__type__i32{2147483647})) {
          (ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::exit(ssc__ts__namespace__0c20efdbea734ed1acb26d93d7ed16fc::ssc__ts__var__result);
      }
    }"
  `);
});

test('logical.ts', async () => {
  expect(await lowerFixture('logical.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98 {
      static ssc__core__type__i32 ssc__ts__var__calls;
      static ssc__core__type__f64 ssc__ts__var__zero;
      static ssc__core__type__i32 ssc__ts__var__n;
      static ssc__core__type__f64 ssc__ts__var__x;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__count(ssc__core__type__i32 ssc__ts__var__value);
      static ssc__core__type__i32 ssc__ts__fn__and(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__or(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b);
      static ssc__core__type__f64 ssc__ts__fn__orFloat(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b);
      static ssc__core__type__boolean ssc__ts__fn__both(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__boolean ssc__ts__var__b);
      static ssc__core__type__i32 ssc__ts__fn__count(ssc__core__type__i32 ssc__ts__var__value) {
        (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__calls = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__calls, ssc__core__type__i32{1}, "i32"));
        return ssc__ts__var__value;
      }
      static ssc__core__type__i32 ssc__ts__fn__and(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return [&] { const ssc__core__type__i32 left = ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__count(ssc__ts__var__a); return (left != 0) ? ssc__ts__var__b : left; }();
      }
      static ssc__core__type__i32 ssc__ts__fn__or(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__u8 ssc__ts__var__b) {
        return [&] { const ssc__core__type__i32 left = ssc__ts__var__a; return (left != 0) ? left : static_cast<ssc__core__type__i32>(ssc__ts__var__b); }();
      }
      static ssc__core__type__f64 ssc__ts__fn__orFloat(ssc__core__type__f64 ssc__ts__var__a, ssc__core__type__i32 ssc__ts__var__b) {
        return [&] { const ssc__core__type__f64 left = ssc__ts__var__a; return ssc__core__fn__truthy_f64(left) ? left : static_cast<ssc__core__type__f64>(ssc__ts__var__b); }();
      }
      static ssc__core__type__boolean ssc__ts__fn__both(ssc__core__type__boolean ssc__ts__var__a, ssc__core__type__boolean ssc__ts__var__b) {
        return (ssc__ts__var__a && ssc__ts__var__b);
      }
      void ssc__core__fn__5442d83d123042ddb5fc7f0665201f98() {
        ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__calls = ssc__core__type__i32{0};
        ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__zero = ssc__core__type__f64{0.0};
        ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__n = ssc__core__type__i32{0};
        ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__x = ssc__core__type__f64{0.5};
        ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__and(ssc__core__type__i32{0}, ssc__core__type__i32{5}) == ssc__core__type__i32{0})) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__and(ssc__core__type__i32{3}, ssc__core__type__i32{5}) == ssc__core__type__i32{5})) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__or(ssc__core__type__i32{0}, ssc__core__type__u8{7u}) == ssc__core__type__i32{7})) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__or(ssc__core__type__i32{4}, ssc__core__type__u8{7u}) == ssc__core__type__i32{4})) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__orFloat((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__zero / ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__zero), ssc__core__type__i32{9}) == ssc__core__type__f64{9.0})) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__fn__both(true, true)) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if ((ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__calls == ssc__core__type__i32{2})) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        if (ssc__core__fn__truthy_f64([&] { const ssc__core__type__f64 left = static_cast<ssc__core__type__f64>(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__n); return ssc__core__fn__truthy_f64(left) ? left : ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__x; }())) {
          (ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result, ssc__core__type__i32{128}, "i32"));
        }
        ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::exit(ssc__ts__namespace__5442d83d123042ddb5fc7f0665201f98::ssc__ts__var__result);
      }
    }"
  `);
});

test('unary.ts', async () => {
  expect(await lowerFixture('unary.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__67368d8d3b0b4dce99427a21ed2cccec() {
        ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__negate(ssc__core__type__u8{200u}) == ssc__core__type__i16{-200})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__negateFloat(ssc__core__type__f32{1.5f}) == ssc__core__type__f32{-1.5f})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__plus(ssc__core__type__i32{7}) == ssc__core__type__f64{7.0})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__not(ssc__core__type__i32{0})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__complement(ssc__core__type__u8{5u}) == ssc__core__type__u8{250u})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__minimum() < ssc__core__type__i64{-9223372036854775807})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if ((ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__fn__addNegative(ssc__core__type__i32{5}) == ssc__core__type__i32{4})) {
          (ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::exit(ssc__ts__namespace__67368d8d3b0b4dce99427a21ed2cccec::ssc__ts__var__result);
      }
    }"
  `);
});

test('update.ts', async () => {
  expect(await lowerFixture('update.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__f5a8dbcb19c049b3afad7a6dd63ce8ab() {
        ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__fn__postfix(ssc__core__type__i32{3}) == ssc__core__type__i32{34})) {
          (ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__fn__prefix(ssc__core__type__i32{3}) == ssc__core__type__i32{44})) {
          (ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__fn__decrement(ssc__core__type__u8{5u}) == ssc__core__type__u8{3u})) {
          (ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__fn__float(ssc__core__type__f64{1.5}) == ssc__core__type__f64{2.5})) {
          (ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__fn__compound(ssc__core__type__i32{4}) == ssc__core__type__i32{3})) {
          (ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__fn__compoundFloat(ssc__core__type__f64{3.0}) == ssc__core__type__f64{1.5})) {
          (ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::exit(ssc__ts__namespace__f5a8dbcb19c049b3afad7a6dd63ce8ab::ssc__ts__var__result);
      }
    }"
  `);
});

test('loop.ts', async () => {
  expect(await lowerFixture('loop.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef {
      static ssc__core__type__i32 ssc__ts__var__top;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__1d0dc1890b964f4a9160bf718ad5dfef() {
        ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__var__top = ssc__core__type__i32{0};
        for (ssc__core__type__i32 ssc__ts__var__k = ssc__core__type__i32{0}; (ssc__ts__var__k < ssc__core__type__i32{3}); ssc__core__fn__increment_postfix(ssc__ts__var__k, "i32")) {
          (ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__var__top = ssc__core__fn__add(ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__var__top, ssc__ts__var__k, "i32"));
        }
        ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::exit(ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__fn__sum(ssc__core__type__i32{5}), ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__fn__countdown(ssc__core__type__i32{4}), "i32"), ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__fn__oddSum(ssc__core__type__i32{10}), "i32"), ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__fn__pair(ssc__core__type__i32{3}), "i32"), ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__fn__block(), "i32"), ssc__ts__namespace__1d0dc1890b964f4a9160bf718ad5dfef::ssc__ts__var__top, "i32"));
      }
    }"
  `);
});

test('constructor.ts', async () => {
  expect(await lowerFixture('constructor.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220 {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__09052c0e68fd4033a98fd8f91f193220() {
        ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__fn__widen(ssc__core__type__i32{-1}) == ssc__core__type__i64{-1})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__core__type__u8{255u} == ssc__core__type__u8{255u})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((static_cast<ssc__core__type__f64>(ssc__core__type__u32{7u}) == ssc__core__type__f64{7.0})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((static_cast<ssc__core__type__u32>(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__fn__of(ssc__core__type__u32{65u})) == ssc__core__type__u32{65u})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((static_cast<ssc__core__type__u32>(ssc__core__fn__char(ssc__core__type__u32{128077u})) == ssc__core__type__u32{128077u})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((static_cast<ssc__core__type__u32>(ssc__core__fn__char(ssc__core__type__u32{65u})) == ssc__core__type__u32{65u})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if ((ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__fn__offset(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__fn__of(ssc__core__type__u32{67u})) == ssc__core__type__u32{2u})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        if ((ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__fn__widenChar(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__fn__of(ssc__core__type__u32{65u}), ssc__core__type__i32{-66}) == ssc__core__type__i64{-1})) {
          (ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result, ssc__core__type__i32{128}, "i32"));
        }
        ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::exit(ssc__ts__namespace__09052c0e68fd4033a98fd8f91f193220::ssc__ts__var__result);
      }
    }"
  `);
});

test('wrap.ts', async () => {
  expect(await lowerFixture('wrap.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b {
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__3da35d8c78d64ecb962040b7b235551b() {
        ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result = ssc__core__type__i32{0};
        if (ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__fn__u8s(ssc__core__type__u8{200u})) {
          (ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__fn__i32s(ssc__core__type__i32{2147483647})) {
          (ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__fn__u16s(ssc__core__type__u16{65535u})) {
          (ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::exit(ssc__ts__namespace__3da35d8c78d64ecb962040b7b235551b::ssc__ts__var__result);
      }
    }"
  `);
});

test('union-value.ts', async () => {
  expect(await lowerFixture('union-value.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd {
      static ssc__core__type__union ssc__ts__var__stored;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
        return ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__orZero(ssc__ts__var__a);
      }
      static ssc__core__type__union ssc__ts__fn__returned(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__ts__var__a;
      }
      static ssc__core__type__i32 ssc__ts__fn__store(ssc__core__type__u8 ssc__ts__var__a) {
        (ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__stored = ssc__ts__var__a);
        return ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__orZero(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__stored));
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
      void ssc__core__fn__0479b71b21ab4e1fbc1e561aaa70b3cd() {
        ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__stored = ssc__core__var__undefined;
        ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__fromU8(ssc__core__type__u8{200u}) == ssc__core__type__i32{200})) {
          (ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__orZero(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__returned(ssc__core__type__u8{100u})) == ssc__core__type__i32{100})) {
          (ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__store(ssc__core__type__u8{50u}) == ssc__core__type__i32{50})) {
          (ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__truthy(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__widen(ssc__core__type__i32{7})) == ssc__core__type__i32{1})) {
          (ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__truthy(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__fn__widen(ssc__core__var__undefined)) == ssc__core__type__i32{0})) {
          (ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::exit(ssc__ts__namespace__0479b71b21ab4e1fbc1e561aaa70b3cd::ssc__ts__var__result);
      }
    }"
  `);
});

test('union.ts', async () => {
  expect(await lowerFixture('union.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0 {
      static ssc__core__type__union ssc__ts__var__last;
      static ssc__core__type__undefined ssc__ts__var__nothing;
      static ssc__core__type__i32 ssc__ts__var__result;
      static ssc__core__type__u8 ssc__ts__var__smallValue;
      static ssc__core__type__i8 ssc__ts__var__negative;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
        const ssc__core__type__union ssc__ts__var__found = ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__find(ssc__ts__var__target);
        if (ssc__core__fn__strict_equals(ssc__ts__var__found, ssc__core__var__undefined)) {
          return ssc__core__type__i32{-1};
        }
        return ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__found), ssc__core__type__i32{1}, "i32");
      }
      static ssc__core__type__i32 ssc__ts__fn__remember(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__union ssc__ts__var__x = ssc__core__var__undefined;
        if ((ssc__ts__var__a > ssc__core__type__i32{0})) {
          (ssc__ts__var__x = ssc__ts__var__a);
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__last = ssc__ts__var__a);
        }
        if ((!ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__undefined))) {
          return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__x);
        }
        return ssc__core__type__i32{0};
      }
      static ssc__core__type__i32 ssc__ts__fn__lastOr(ssc__core__type__i32 ssc__ts__var__fallback) {
        if (ssc__core__fn__strict_equals(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__last, ssc__core__var__undefined)) {
          return ssc__ts__var__fallback;
        }
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__last);
      }
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__v) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__v, ssc__core__var__undefined)) {
          return ssc__core__type__i32{0};
        }
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__ts__var__v);
      }
      static ssc__core__type__i32 ssc__ts__fn__small(ssc__core__type__u8 ssc__ts__var__a) {
        return ssc__core__fn__add(ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__orZero(ssc__ts__var__a), ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__orZero(ssc__core__var__undefined), "i32"), ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__orZero(ssc__core__type__i32{300}), "i32");
      }
      static ssc__core__type__i64 ssc__ts__fn__next(ssc__core__type__union ssc__ts__var__v) {
        return ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i64>(ssc__ts__var__v), ssc__core__type__i64{1}, "i64");
      }
      static ssc__core__type__i64 ssc__ts__fn__both(ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b) {
        return ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__next(ssc__ts__var__a), ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__next(ssc__ts__var__b), "i64");
      }
      static ssc__core__type__i32 ssc__ts__fn__score(ssc__core__type__union ssc__ts__var__x) {
        if (ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__undefined)) {
          return ssc__core__type__i32{0};
        }
        if (ssc__core__fn__strict_equals(ssc__core__fn__typeof(ssc__ts__var__x), ssc__core__fn__string_literal<u8"boolean">())) {
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
        if (ssc__core__fn__strict_equals(ssc__core__fn__typeof(ssc__ts__var__x), ssc__core__fn__string_literal<u8"object">())) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{2};
      }
      static ssc__core__type__f64 ssc__ts__fn__mixed(ssc__core__type__union ssc__ts__var__x) {
        return (ssc__core__fn__union_to_number<ssc__core__type__f64>(ssc__ts__var__x) + ssc__core__type__f64{0.5});
      }
      static ssc__core__type__undefined ssc__ts__fn__none() {
        return ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__nothing;
      }
      static ssc__core__type__i32 ssc__ts__fn__nullCount(ssc__core__type__null ssc__ts__var__x) {
        return ssc__core__type__i32{1};
      }
      static ssc__core__type__union ssc__ts__fn__wrap() {
        const ssc__core__type__undefined ssc__ts__var__value = ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__none();
        return ssc__ts__var__value;
      }
      static ssc__core__type__i32 ssc__ts__fn__unwrap(ssc__core__type__i32 ssc__ts__var__a) {
        ssc__core__type__union ssc__ts__var__x = ssc__core__var__null;
        if ((ssc__ts__var__a > ssc__core__type__i32{0})) {
          (ssc__ts__var__x = ssc__ts__var__a);
        }
        if (ssc__core__fn__strict_equals(ssc__ts__var__x, ssc__core__var__null)) {
          const ssc__core__type__null ssc__ts__var__y = ssc__core__fn__union_to_null(ssc__ts__var__x);
          return ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__nullCount(ssc__ts__var__y);
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__1a33f166e3b949ea8f8b80e29f11b2c0() {
        ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__last = ssc__core__var__undefined;
        ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__nothing = ssc__core__var__undefined;
        ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__type__i32{0};
        if (((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__use(ssc__core__type__i32{3}) == ssc__core__type__i32{7}) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__use(ssc__core__type__i32{20}) == ssc__core__type__i32{-1}))) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (((((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__lastOr(ssc__core__type__i32{9}) == ssc__core__type__i32{9}) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__remember(ssc__core__type__i32{5}) == ssc__core__type__i32{5})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__remember(ssc__core__type__i32{-1}) == ssc__core__type__i32{0})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__lastOr(ssc__core__type__i32{9}) == ssc__core__type__i32{5}))) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if ((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__small(ssc__core__type__u8{7u}) == ssc__core__type__i32{307})) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__both(ssc__core__type__i32{1}, ssc__core__type__i64{10}) == ssc__core__type__i64{13})) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if (((((((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__score(ssc__core__var__undefined) == ssc__core__type__i32{0}) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__score(true) == ssc__core__type__i32{1})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__score(false) == ssc__core__type__i32{2})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__score(ssc__core__type__i32{5}) == ssc__core__type__i32{15})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__score(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__widen(ssc__core__type__i32{7})) == ssc__core__type__i32{17})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__score(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__widen(ssc__core__var__undefined)) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if ((((((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__orNegative(ssc__core__var__null) == ssc__core__type__i32{-1}) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__orNegative(ssc__core__type__i32{4}) == ssc__core__type__i32{4})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__kind(ssc__core__var__undefined) == ssc__core__type__i32{0})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__kind(ssc__core__var__null) == ssc__core__type__i32{1})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__kind(ssc__core__type__i32{7}) == ssc__core__type__i32{2}))) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__smallValue = ssc__core__type__u8{2u};
        ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__negative = ssc__core__type__i8{-3};
        if ((((ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__mixed(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__smallValue) == ssc__core__type__f64{2.5}) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__mixed(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__negative) == ssc__core__type__f64{-2.5})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__mixed(ssc__core__type__f64{1.5}) == ssc__core__type__f64{2.0}))) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        if ((((ssc__core__fn__strict_equals(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__wrap(), ssc__core__var__undefined) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__nullCount(ssc__core__var__null) == ssc__core__type__i32{1})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__unwrap(ssc__core__type__i32{-1}) == ssc__core__type__i32{1})) && (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__fn__unwrap(ssc__core__type__i32{1}) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result, ssc__core__type__i32{128}, "i32"));
        }
        ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::exit(ssc__ts__namespace__1a33f166e3b949ea8f8b80e29f11b2c0::ssc__ts__var__result);
      }
    }"
  `);
});

test('string.ts', async () => {
  expect(await lowerFixture('string.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779 {
      static ssc__core__type__ref ssc__ts__var__top;
      static ssc__core__type__u64 ssc__ts__var__topLength;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
        return ssc__core__fn__strict_equals(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__boolean ssc__ts__fn__differs(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return (!ssc__core__fn__strict_equals(ssc__ts__var__a, ssc__ts__var__b));
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
        if ((ssc__core__fn__strict_equals(ssc__core__fn__typeof(ssc__ts__var__v), ssc__core__fn__string_literal<u8"string">()) && (ssc__core__fn__string_length(ssc__core__fn__union_to_ref(ssc__ts__var__v)) == ssc__core__type__u64{2u}))) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{2};
      }
      static ssc__core__type__ref ssc__ts__fn__join(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__ref ssc__ts__var__b) {
        return ssc__core__fn__string_concat(ssc__ts__var__a, ssc__ts__var__b);
      }
      static ssc__core__type__ref ssc__ts__fn__withChar(ssc__core__type__ref ssc__ts__var__a, ssc__core__type__char ssc__ts__var__c) {
        return ssc__core__fn__string_concat(ssc__ts__var__a, ssc__core__fn__to_string(ssc__ts__var__c));
      }
      static ssc__core__type__ref ssc__ts__fn__append(ssc__core__type__ref ssc__ts__var__a) {
        ssc__core__type__ref ssc__ts__var__s = ssc__ts__var__a;
        (ssc__ts__var__s = ssc__core__fn__string_concat(ssc__ts__var__s, ssc__core__fn__string_literal<u8"!">()));
        return ssc__ts__var__s;
      }
      static ssc__core__type__i32 ssc__ts__fn__truthy(ssc__core__type__ref ssc__ts__var__s) {
        if (ssc__core__fn__truthy_ref(ssc__ts__var__s)) {
          return ssc__core__type__i32{1};
        }
        return ssc__core__type__i32{0};
      }
      void ssc__core__fn__6c1c42aafe284ec8b3141605445b1779() {
        ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__top = ssc__core__fn__string_literal<u8"abc">();
        ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__topLength = ssc__core__fn__string_length(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__top);
        ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__type__i32{0};
        if (((((ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"hello">()) == ssc__core__type__u64{5u}) && (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"한글">()) == ssc__core__type__u64{6u})) && (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"👍">()) == ssc__core__type__u64{4u})) && (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__length(ssc__core__fn__string_literal<u8"">()) == ssc__core__type__u64{0u}))) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__topLength == ssc__core__type__u64{3u})) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (((((((ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"abc">(), ssc__core__fn__string_literal<u8"abc">()) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"">(), ssc__core__fn__string_literal<u8"">())) && (!ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"abc">(), ssc__core__fn__string_literal<u8"abd">()))) && (!ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"ab">(), ssc__core__fn__string_literal<u8"abc">()))) && (!ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__equals(ssc__core__fn__string_literal<u8"a\\000b">(), ssc__core__fn__string_literal<u8"a\\000c">()))) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__differs(ssc__core__fn__string_literal<u8"한">(), ssc__core__fn__string_literal<u8"글">())) && (!ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__differs(ssc__core__fn__string_literal<u8"👍">(), ssc__core__fn__string_literal<u8"👍">())))) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if ((((((((((ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"b">()) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"ab">(), ssc__core__fn__string_literal<u8"abc">())) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"">(), ssc__core__fn__string_literal<u8"a">())) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"B">(), ssc__core__fn__string_literal<u8"a">())) && (!ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"a">()))) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__lessOrEqual(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"a">())) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__greater(ssc__core__fn__string_literal<u8"한">(), ssc__core__fn__string_literal<u8"z">())) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__greaterOrEqual(ssc__core__fn__string_literal<u8"b">(), ssc__core__fn__string_literal<u8"a">())) && (!ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__greaterOrEqual(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"b">()))) && ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__less(ssc__core__fn__string_literal<u8"￿">(), ssc__core__fn__string_literal<u8"😀">()))) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if ((((ssc__core__fn__strict_equals(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__orEmpty(ssc__core__fn__string_literal<u8"hi">()), ssc__core__fn__string_literal<u8"hi">()) && ssc__core__fn__strict_equals(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__orEmpty(ssc__core__var__undefined), ssc__core__fn__string_literal<u8"">())) && (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__kind(ssc__core__fn__string_literal<u8"ab">()) == ssc__core__type__i32{1})) && (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__kind(ssc__core__type__i32{7}) == ssc__core__type__i32{2}))) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (((ssc__core__fn__strict_equals(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__join(ssc__core__fn__string_literal<u8"ab">(), ssc__core__fn__string_literal<u8"cd">()), ssc__core__fn__string_literal<u8"abcd">()) && ssc__core__fn__strict_equals(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__withChar(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__char(ssc__core__type__u32{128077u})), ssc__core__fn__string_literal<u8"a👍">())) && ssc__core__fn__strict_equals(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__append(ssc__core__fn__string_literal<u8"hi">()), ssc__core__fn__string_literal<u8"hi!">()))) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        if (((ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__truthy(ssc__core__fn__string_literal<u8"x">()) == ssc__core__type__i32{1}) && (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__fn__truthy(ssc__core__fn__string_literal<u8"">()) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result, ssc__core__type__i32{64}, "i32"));
        }
        ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::exit(ssc__ts__namespace__6c1c42aafe284ec8b3141605445b1779::ssc__ts__var__result);
      }
    }"
  `);
});

test('equality.ts', async () => {
  expect(await lowerFixture('equality.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4 {
      static ssc__core__type__u64 ssc__ts__var__big;
      static ssc__core__type__i64 ssc__ts__var__minus;
      static ssc__core__type__i32 ssc__ts__var__result;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__e14924753f344a18a1ac49899afdb0e4() {
        ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__big = ssc__core__type__u64{18446744073709551615u};
        ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__minus = ssc__core__type__i64{-1};
        ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__type__i32{0};
        if (((ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isFive(ssc__core__type__i32{5}) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isFive(ssc__core__type__i32{6}))) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isFive(ssc__core__var__undefined)))) {
          (ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if (((ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isHi(ssc__core__fn__string_literal<u8"hi">()) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isHi(ssc__core__fn__string_literal<u8"ho">()))) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isHi(ssc__core__var__undefined)))) {
          (ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (((ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__same(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__minus, ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__minus) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__same(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__minus, ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__big))) && ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__same(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__big, ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__big))) {
          (ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (((ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isTrue(true) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isTrue(false))) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isTrue(ssc__core__var__undefined)))) {
          (ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        if (((ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isA(ssc__core__fn__char(ssc__core__type__u32{65u})) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isA(ssc__core__fn__char(ssc__core__type__u32{66u})))) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isA(ssc__core__var__undefined)))) {
          (ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result, ssc__core__type__i32{16}, "i32"));
        }
        if (((ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isTwo(ssc__core__type__i64{2}) && ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isTwo(ssc__core__type__i64{2})) && (!ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__fn__isTwo(ssc__core__type__f64{2.5})))) {
          (ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result, ssc__core__type__i32{32}, "i32"));
        }
        ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::exit(ssc__ts__namespace__e14924753f344a18a1ac49899afdb0e4::ssc__ts__var__result);
      }
    }"
  `);
});

test('numeric.ts', async () => {
  expect(await lowerFixture('numeric.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d {
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
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
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
      void ssc__core__fn__03948a93c8b149a9a0447310d2d5b52d() {
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__half = (ssc__core__type__f64{1.0} / ssc__core__type__f64{2.0});
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__big = ssc__core__type__f64{100000000000000000000.0};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__small = ssc__core__type__f32{0.1f};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__overflow = ssc__core__type__f64{__builtin_inf()};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__underflow = ssc__core__type__f64{0.0};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__overflow32 = ssc__core__type__f32{__builtin_inff()};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__exponent = ssc__core__type__i32{1000};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__negative = ssc__core__type__f32{-1.5f};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__fromUnderflow = ssc__core__type__i32{0};
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result = ssc__core__type__i32{0};
        if ((ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__half == ssc__core__type__f64{0.5})) {
          (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result, ssc__core__type__i32{1}, "i32"));
        }
        if ((ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__fn__twice(ssc__core__type__i32{21}) == ssc__core__type__i32{42})) {
          (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result, ssc__core__type__i32{2}, "i32"));
        }
        if (((ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__fn__u8s(ssc__core__type__u8{200u}, ssc__core__type__u8{55u}) && ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__fn__i32s(ssc__core__type__i32{-5}, ssc__core__type__i32{2})) && (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__fn__minimumRemainder(ssc__core__type__i32{-2147483648}, ssc__core__type__i32{-1}) == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result, ssc__core__type__i32{4}, "i32"));
        }
        if (((((((((static_cast<ssc__core__type__f64>(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__big) == ssc__core__type__f64{100000000000000000000.0}) && (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__small == ssc__core__type__f32{0.1f})) && (static_cast<ssc__core__type__f64>(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__overflow) > ssc__core__type__f64{100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000.0})) && (static_cast<ssc__core__type__f64>(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__underflow) == ssc__core__type__f64{0.0})) && (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__overflow32 > ssc__core__type__f32{100000000000000000000000000000000000000.0f})) && (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__exponent == ssc__core__type__i32{1000})) && (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__negative == ssc__core__type__f32{-1.5f})) && (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__fromUnderflow == ssc__core__type__i32{0}))) {
          (ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result = ssc__core__fn__add(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result, ssc__core__type__i32{8}, "i32"));
        }
        ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::exit(ssc__ts__namespace__03948a93c8b149a9a0447310d2d5b52d::ssc__ts__var__result);
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

test('output.ts', async () => {
  expect(await lowerFixture('output.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__3cbe4d4831ec4c1fb5685af9d5b1824c {
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__ref ssc__ts__fn__greet(ssc__core__type__ref ssc__ts__var__name);
      static ssc__core__type__ref ssc__ts__fn__greet(ssc__core__type__ref ssc__ts__var__name) {
        return ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"hello, ">(), ssc__ts__var__name), ssc__core__fn__string_literal<u8"\\012">());
      }
      void ssc__core__fn__3cbe4d4831ec4c1fb5685af9d5b1824c() {
        ssc__core__fn__write_stdout(ssc__ts__namespace__3cbe4d4831ec4c1fb5685af9d5b1824c::ssc__ts__fn__greet(ssc__core__fn__string_literal<u8"syscript">()));
        ssc__core__fn__write_stdout(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"한글 ">(), ssc__core__fn__to_string(ssc__core__fn__char(ssc__core__type__u32{128077u}))), ssc__core__fn__string_literal<u8"\\012">()));
        ssc__core__fn__write_stderr(ssc__core__fn__string_literal<u8"warning\\012">());
        ssc__ts__namespace__3cbe4d4831ec4c1fb5685af9d5b1824c::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});

test('template.ts', async () => {
  expect(await lowerFixture('template.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad {
      static ssc__core__type__ref ssc__ts__var__name;
      static ssc__core__type__i32 ssc__ts__var__count;
      static ssc__core__type__f64 ssc__ts__var__ratio;
      static ssc__core__type__char ssc__ts__var__emoji;
      static ssc__core__type__boolean ssc__ts__var__flag;
      static ssc__core__type__union ssc__ts__var__value;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__3bc3403a854e470cb5adeee04d3d7fad() {
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__name = ssc__core__fn__string_literal<u8"syscript">();
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__count = ssc__core__type__i32{3};
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__ratio = ssc__core__type__f64{0.5};
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__emoji = ssc__core__fn__char(ssc__core__type__u32{128077u});
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__flag = true;
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__value = ssc__core__var__undefined;
        ssc__core__fn__console_log(ssc__core__fn__string_literal<u8"plain">());
        ssc__core__fn__console_log(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"hello, ">(), ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__name), ssc__core__fn__string_literal<u8"!">()));
        ssc__core__fn__console_log(ssc__core__fn__string_concat(ssc__core__fn__to_string(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__count), ssc__core__fn__string_literal<u8" items">()));
        ssc__core__fn__console_log(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"ratio=">(), ssc__core__fn__to_string(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__ratio)), ssc__core__fn__string_literal<u8", ok=">()), ssc__core__fn__to_string(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__flag)), ssc__core__fn__string_literal<u8", value=">()), ssc__core__fn__to_string(ssc__core__fn__union_to_undefined(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__value))));
        ssc__core__fn__console_log(ssc__core__fn__string_concat(ssc__core__fn__to_string(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__emoji), ssc__core__fn__to_string(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__emoji)));
        ssc__core__fn__console_log(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"sum=">(), ssc__core__fn__to_string(ssc__core__fn__add(ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__count, ssc__core__type__i32{1}, "i32"))), ssc__core__fn__string_literal<u8", nested=">()), ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"[">(), ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__name), ssc__core__fn__string_literal<u8"]">())));
        ssc__core__fn__console_log(ssc__core__fn__string_concat(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"한글 ">(), ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::ssc__ts__var__name), ssc__core__fn__string_literal<u8" \${escaped} \`tick\`">()));
        ssc__core__fn__console_log(ssc__core__fn__string_literal<u8"line1\\012line2">());
        ssc__ts__namespace__3bc3403a854e470cb5adeee04d3d7fad::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});

test('as.ts', async () => {
  expect(await lowerFixture('as.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23 {
      static ssc__core__type__i32 ssc__ts__var__literal;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__toInteger(ssc__core__type__union ssc__ts__var__value);
      static ssc__core__type__ref ssc__ts__fn__toText(ssc__core__type__union ssc__ts__var__value);
      static ssc__core__type__union ssc__ts__fn__toOptionalText(ssc__core__type__union ssc__ts__var__value);
      static ssc__core__type__boolean ssc__ts__fn__toFlag(ssc__core__type__union ssc__ts__var__value);
      static ssc__core__type__i32 ssc__ts__fn__same(ssc__core__type__i32 ssc__ts__var__value);
      static ssc__core__type__union ssc__ts__fn__widen(ssc__core__type__i32 ssc__ts__var__value);
      static ssc__core__type__i32 ssc__ts__fn__toInteger(ssc__core__type__union ssc__ts__var__value) {
        return ssc__core__fn__union_as<ssc__core__type__i32>(ssc__ts__var__value, "i32");
      }
      static ssc__core__type__ref ssc__ts__fn__toText(ssc__core__type__union ssc__ts__var__value) {
        return ssc__core__fn__union_as<ssc__core__type__ref>(ssc__ts__var__value, "string");
      }
      static ssc__core__type__union ssc__ts__fn__toOptionalText(ssc__core__type__union ssc__ts__var__value) {
        return ssc__core__fn__union_as_union<ssc__core__type__undefined, ssc__core__type__ref>(ssc__ts__var__value, "string | undefined");
      }
      static ssc__core__type__boolean ssc__ts__fn__toFlag(ssc__core__type__union ssc__ts__var__value) {
        return ssc__core__fn__union_as<ssc__core__type__boolean>(ssc__ts__var__value, "boolean");
      }
      static ssc__core__type__i32 ssc__ts__fn__same(ssc__core__type__i32 ssc__ts__var__value) {
        return ssc__ts__var__value;
      }
      static ssc__core__type__union ssc__ts__fn__widen(ssc__core__type__i32 ssc__ts__var__value) {
        return ssc__core__type__union(ssc__ts__var__value);
      }
      void ssc__core__fn__00b06f02e0264eee82624684b84a6d23() {
        ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__var__literal = ssc__core__type__i32{5};
        ssc__core__fn__console_log(ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__toInteger(ssc__core__type__i32{7}), ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__toText(ssc__core__fn__string_literal<u8"a">()), ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__toOptionalText(ssc__core__var__undefined), ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__toOptionalText(ssc__core__fn__string_literal<u8"b">()), ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__toFlag(true));
        ssc__core__fn__console_log(ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__same(ssc__core__type__i32{3}), ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__toInteger(ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__fn__widen(ssc__core__type__i32{4})), ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::ssc__ts__var__literal);
        ssc__ts__namespace__00b06f02e0264eee82624684b84a6d23::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});

test('array.ts', async () => {
  expect(await lowerFixture('array.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7 {
      static ssc__core__type__ref ssc__ts__var__numbers;
      static ssc__core__type__ref ssc__ts__var__words;
      static ssc__core__type__ref ssc__ts__var__empty;
      static ssc__core__type__ref ssc__ts__var__mixed;
      static ssc__core__type__ref ssc__ts__var__nested;
      static ssc__core__type__u64 ssc__ts__var__length;
      static ssc__core__type__union ssc__ts__var__popped;
      static ssc__core__type__ref ssc__ts__var__shared;
      static ssc__core__type__u64 ssc__ts__var__index;
      static ssc__core__type__i32 ssc__ts__var__total;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      void ssc__core__fn__d3944d1aef8e41bdb6300fec9e713af7() {
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers = ssc__core__fn__array_of<ssc__core__type__i32>(ssc__core__type__i32{1}, ssc__core__type__i32{2}, ssc__core__type__i32{3});
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__words = ssc__core__fn__array_of<ssc__core__type__ref>(ssc__core__fn__string_literal<u8"a">(), ssc__core__fn__string_literal<u8"b">());
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__empty = ssc__core__fn__array_of<ssc__core__type__f64>();
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__mixed = ssc__core__fn__array_of<ssc__core__type__union>(ssc__core__type__i32{1}, ssc__core__fn__string_literal<u8"x">());
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__nested = ssc__core__fn__array_of<ssc__core__type__ref>(ssc__core__fn__array_of<ssc__core__type__i32>(ssc__core__type__i32{1}, ssc__core__type__i32{2}), ssc__core__fn__array_of<ssc__core__type__i32>(ssc__core__type__i32{3}));
        ssc__core__fn__console_log(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__words, ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__empty, ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__mixed, ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__nested);
        ssc__core__fn__console_log(ssc__core__fn__array_length(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers), ssc__core__fn__array_get<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__core__type__u64{0u}), ssc__core__fn__array_get<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__core__type__u64{2u}), ssc__core__fn__array_get<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__core__type__u64{3u}));
        ssc__core__fn__array_set<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__core__type__u64{1u}, ssc__core__type__i32{20});
        ssc__core__fn__console_log(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers);
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__length = ssc__core__fn__array_push<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__core__type__i32{4}, ssc__core__type__i32{5});
        ssc__core__fn__console_log(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__length, ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers);
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__popped = ssc__core__fn__array_pop<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers);
        ssc__core__fn__console_log(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__popped, ssc__core__fn__array_length(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers), ssc__core__fn__array_pop<ssc__core__type__f64>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__empty));
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__shared = ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers;
        ssc__core__fn__array_push<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__shared, ssc__core__type__i32{6});
        ssc__core__fn__console_log(ssc__core__fn__array_length(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers));
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__index = ssc__core__type__u64{1u};
        ssc__core__fn__console_log(ssc__core__fn__array_get<ssc__core__type__ref>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__words, ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__index), ssc__core__fn__to_string(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers), ssc__core__fn__string_concat(ssc__core__fn__string_literal<u8"w=">(), ssc__core__fn__to_string(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__words)));
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__total = ssc__core__type__i32{0};
        for (ssc__core__type__u64 ssc__ts__var__i = ssc__core__type__u64{0u}; (ssc__ts__var__i < ssc__core__fn__array_length(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers)); ssc__core__fn__increment_postfix(ssc__ts__var__i, "u64")) {
          (ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__total = ssc__core__fn__add(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__total, ssc__core__fn__union_as<ssc__core__type__i32>(ssc__core__fn__array_get<ssc__core__type__i32>(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__numbers, ssc__ts__var__i), "i32"), "i32"));
        }
        ssc__core__fn__console_log(ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::ssc__ts__var__total);
        ssc__ts__namespace__d3944d1aef8e41bdb6300fec9e713af7::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});

test('conditional.ts', async () => {
  expect(await lowerFixture('conditional.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13 {
      static ssc__core__type__boolean ssc__ts__var__flag;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i64 ssc__ts__fn__pick(ssc__core__type__boolean ssc__ts__var__c, ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b);
      static ssc__core__type__union ssc__ts__fn__choose(ssc__core__type__boolean ssc__ts__var__c, ssc__core__type__i32 ssc__ts__var__a);
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__u);
      static ssc__core__type__union ssc__ts__fn__orText(ssc__core__type__union ssc__ts__var__u);
      static ssc__core__type__ref ssc__ts__fn__orDefault(ssc__core__type__union ssc__ts__var__u);
      static ssc__core__type__i64 ssc__ts__fn__pick(ssc__core__type__boolean ssc__ts__var__c, ssc__core__type__i32 ssc__ts__var__a, ssc__core__type__i64 ssc__ts__var__b) {
        return (ssc__ts__var__c ? static_cast<ssc__core__type__i64>(ssc__ts__var__a) : ssc__ts__var__b);
      }
      static ssc__core__type__union ssc__ts__fn__choose(ssc__core__type__boolean ssc__ts__var__c, ssc__core__type__i32 ssc__ts__var__a) {
        return (ssc__ts__var__c ? ssc__core__type__union(ssc__ts__var__a) : ssc__core__type__union(ssc__core__fn__string_literal<u8"none">()));
      }
      static ssc__core__type__i32 ssc__ts__fn__orZero(ssc__core__type__union ssc__ts__var__u) {
        return ssc__core__fn__union_to_number<ssc__core__type__i32>([&] { const ssc__core__type__union left = ssc__ts__var__u; return ssc__core__fn__union_is_undefined(left) || ssc__core__fn__union_is_null(left) ? ssc__core__type__union(ssc__core__type__i32{0}) : left; }());
      }
      static ssc__core__type__union ssc__ts__fn__orText(ssc__core__type__union ssc__ts__var__u) {
        return [&] { const ssc__core__type__union left = ssc__ts__var__u; return ssc__core__fn__union_is_undefined(left) || ssc__core__fn__union_is_null(left) ? ssc__core__type__union(ssc__core__fn__string_literal<u8"none">()) : left; }();
      }
      static ssc__core__type__ref ssc__ts__fn__orDefault(ssc__core__type__union ssc__ts__var__u) {
        return [&] { const ssc__core__type__union left = ssc__ts__var__u; return ssc__core__fn__union_is_undefined(left) || ssc__core__fn__union_is_null(left) ? ssc__core__fn__string_literal<u8"default">() : ssc__core__fn__union_to_ref(left); }();
      }
      void ssc__core__fn__6daa5c5e6b7b499090b8b43c458a0e13() {
        ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__var__flag = true;
        ssc__core__fn__console_log(ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__pick(true, ssc__core__type__i32{1}, ssc__core__type__i64{2}), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__pick(false, ssc__core__type__i32{1}, ssc__core__type__i64{2}), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__choose(true, ssc__core__type__i32{3}), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__choose(false, ssc__core__type__i32{3}));
        ssc__core__fn__console_log(ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__orZero(ssc__core__type__i32{5}), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__orZero(ssc__core__var__undefined), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__orText(ssc__core__type__i32{6}), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__orText(ssc__core__var__undefined), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__orDefault(ssc__core__var__null), ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__fn__orDefault(ssc__core__fn__string_literal<u8"x">()));
        ssc__core__fn__console_log((ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__var__flag ? ssc__core__fn__string_literal<u8"yes">() : ssc__core__fn__string_literal<u8"no">()), ((!ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::ssc__ts__var__flag) ? ssc__core__type__union(ssc__core__type__f64{1.0}) : ssc__core__type__union(ssc__core__type__f64{2.0})));
        ssc__ts__namespace__6daa5c5e6b7b499090b8b43c458a0e13::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});

test('closure.ts', async () => {
  expect(await lowerFixture('closure.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6 {
      static ssc__core__type__i32 ssc__ts__var__total;
      static ssc__core__type__ref ssc__ts__var__addTotal;
      static ssc__core__type__ref ssc__ts__var__a;
      static ssc__core__type__ref ssc__ts__var__b;
      static ssc__core__type__ref ssc__ts__var__add5;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__ref ssc__ts__fn__makeCounter();
      static ssc__core__type__i32 ssc__ts__fn__apply(ssc__core__type__ref ssc__ts__var__f, ssc__core__type__i32 ssc__ts__var__value);
      static ssc__core__type__i32 ssc__ts__fn__double(ssc__core__type__i32 ssc__ts__var__x);
      static ssc__core__type__ref ssc__ts__fn__makeAdder(ssc__core__type__i32 ssc__ts__var__step);
      static ssc__core__type__i32 ssc__ts__fn__shared();
      static ssc__core__type__i32 ssc__ts__fn__nested();
      static ssc__core__type__i32 ssc__ts__fn__loop();
      const ssc__core__struct__closure ssc__ts__closure__double{{0, __builtin_addressof(ssc__core__var__closure_descriptor)}, +[](const ssc__core__struct__closure*, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { return ssc__core__type__union(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__double(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__var__arguments[0]))); }, {0, nullptr}};
      static ssc__core__type__ref ssc__ts__fn__makeCounter() {
        ssc__core__type__ref ssc__ts__box__count = ssc__core__fn__box(ssc__core__type__union(ssc__core__type__i32{0}));
        return ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { return ssc__core__type__union([&] { const ssc__core__type__i32 previous = ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__core__var__closure->ssc__core__member__captures[0])); const ssc__core__type__i32 next = ssc__core__fn__add(previous, ssc__core__type__i32{1}, "i32"); ssc__core__fn__box_value(ssc__core__var__closure->ssc__core__member__captures[0]) = next; return next; }()); return ssc__core__type__union(ssc__core__var__undefined); }, {ssc__ts__box__count.ssc__core__member__get_object_header_pointer()});
      }
      static ssc__core__type__i32 ssc__ts__fn__apply(ssc__core__type__ref ssc__ts__var__f, ssc__core__type__i32 ssc__ts__var__value) {
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__ts__var__f, {ssc__core__type__union(ssc__ts__var__value)}));
      }
      static ssc__core__type__i32 ssc__ts__fn__double(ssc__core__type__i32 ssc__ts__var__x) {
        return ssc__core__fn__mul(ssc__ts__var__x, ssc__core__type__i32{2}, "i32");
      }
      static ssc__core__type__ref ssc__ts__fn__makeAdder(ssc__core__type__i32 ssc__ts__var__step) {
        ssc__core__type__ref ssc__ts__box__step = ssc__core__fn__box(ssc__ts__var__step);
        return ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { const ssc__core__type__i32 ssc__ts__var__x = ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__var__arguments[0]); return ssc__core__type__union(ssc__core__fn__add(ssc__ts__var__x, ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__core__var__closure->ssc__core__member__captures[0])), "i32")); return ssc__core__type__union(ssc__core__var__undefined); }, {ssc__ts__box__step.ssc__core__member__get_object_header_pointer()});
      }
      static ssc__core__type__i32 ssc__ts__fn__shared() {
        ssc__core__type__ref ssc__ts__box__value = ssc__core__fn__box(ssc__core__type__union(ssc__core__type__i32{1}));
        const ssc__core__type__ref ssc__ts__var__set = ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { const ssc__core__type__i32 ssc__ts__var__next = ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__var__arguments[0]); (ssc__core__fn__box_value(ssc__core__var__closure->ssc__core__member__captures[0]) = ssc__ts__var__next); return ssc__core__type__union(ssc__core__var__undefined); }, {ssc__ts__box__value.ssc__core__member__get_object_header_pointer()});
        ssc__core__fn__call(ssc__ts__var__set, {ssc__core__type__union(ssc__core__type__i32{10})});
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__ts__box__value.ssc__core__member__get_object_header_pointer()));
      }
      static ssc__core__type__i32 ssc__ts__fn__nested() {
        ssc__core__type__ref ssc__ts__box__base = ssc__core__fn__box(ssc__core__type__union(ssc__core__type__i32{1}));
        const ssc__core__type__ref ssc__ts__var__outer = ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { return ssc__core__type__union(ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { return ssc__core__type__union(ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__core__var__closure->ssc__core__member__captures[0])), ssc__core__type__i32{1}, "i32")); return ssc__core__type__union(ssc__core__var__undefined); }, {ssc__core__var__closure->ssc__core__member__captures[0]})); return ssc__core__type__union(ssc__core__var__undefined); }, {ssc__ts__box__base.ssc__core__member__get_object_header_pointer()});
        (ssc__core__fn__box_value(ssc__ts__box__base.ssc__core__member__get_object_header_pointer()) = ssc__core__type__i32{5});
        return ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__core__fn__union_to_ref(ssc__core__fn__call(ssc__ts__var__outer, {})), {}));
      }
      static ssc__core__type__i32 ssc__ts__fn__loop() {
        const ssc__core__type__ref ssc__ts__var__functions = ssc__core__fn__array_of<ssc__core__type__ref>();
        for (ssc__core__type__ref ssc__ts__box__i = ssc__core__fn__box(ssc__core__type__union(ssc__core__type__i32{0})); (ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__ts__box__i.ssc__core__member__get_object_header_pointer())) < ssc__core__type__i32{3}); ssc__ts__box__i = ssc__core__fn__box(ssc__core__fn__box_value(ssc__ts__box__i.ssc__core__member__get_object_header_pointer())), [&] { const ssc__core__type__i32 previous = ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__ts__box__i.ssc__core__member__get_object_header_pointer())); const ssc__core__type__i32 next = ssc__core__fn__add(previous, ssc__core__type__i32{1}, "i32"); ssc__core__fn__box_value(ssc__ts__box__i.ssc__core__member__get_object_header_pointer()) = next; return previous; }()) {
          ssc__core__fn__array_push<ssc__core__type__ref>(ssc__ts__var__functions, ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { return ssc__core__type__union(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__box_value(ssc__core__var__closure->ssc__core__member__captures[0]))); return ssc__core__type__union(ssc__core__var__undefined); }, {ssc__ts__box__i.ssc__core__member__get_object_header_pointer()}));
        }
        return ssc__core__fn__add(ssc__core__fn__add(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__core__fn__union_as<ssc__core__type__ref>(ssc__core__fn__array_get<ssc__core__type__ref>(ssc__ts__var__functions, ssc__core__type__u64{0u}), "() => i32"), {})), ssc__core__fn__mul(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__core__fn__union_as<ssc__core__type__ref>(ssc__core__fn__array_get<ssc__core__type__ref>(ssc__ts__var__functions, ssc__core__type__u64{1u}), "() => i32"), {})), ssc__core__type__i32{10}, "i32"), "i32"), ssc__core__fn__mul(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__core__fn__union_as<ssc__core__type__ref>(ssc__core__fn__array_get<ssc__core__type__ref>(ssc__ts__var__functions, ssc__core__type__u64{2u}), "() => i32"), {})), ssc__core__type__i32{100}, "i32"), "i32");
      }
      void ssc__core__fn__15d97f8e387643d1bf855b120ebfe3b6() {
        ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__total = ssc__core__type__i32{0};
        ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__addTotal = ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { const ssc__core__type__i32 ssc__ts__var__x = ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__var__arguments[0]); (ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__total = ssc__core__fn__add(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__total, ssc__ts__var__x, "i32")); return ssc__core__type__union(ssc__core__var__undefined); }, {});
        ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a = ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__makeCounter();
        ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__b = ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__makeCounter();
        ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__add5 = ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__makeAdder(ssc__core__type__i32{5});
        ssc__core__fn__console_log(ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a, {})), ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a, {})), ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__b, {})), ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__fn__call(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a, {})));
        ssc__core__fn__console_log(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__apply(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__add5, ssc__core__type__i32{10}), ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__apply(ssc__core__fn__function_value(ssc__ts__closure__double), ssc__core__type__i32{21}), ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__apply(ssc__core__fn__closure(+[](const ssc__core__struct__closure* ssc__core__var__closure, ssc__core__struct__span<ssc__core__type__union> ssc__core__var__arguments) -> ssc__core__type__union { const ssc__core__type__i32 ssc__ts__var__x = ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__var__arguments[0]); return ssc__core__type__union(ssc__core__fn__sub(ssc__ts__var__x, ssc__core__type__i32{1}, "i32")); return ssc__core__type__union(ssc__core__var__undefined); }, {}), ssc__core__type__i32{1}));
        ssc__core__fn__call(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__addTotal, {ssc__core__type__union(ssc__core__type__i32{3})});
        ssc__core__fn__call(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__addTotal, {ssc__core__type__union(ssc__core__type__i32{4})});
        ssc__core__fn__console_log(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__total);
        ssc__core__fn__console_log(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__shared(), ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__nested(), ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__fn__loop());
        ssc__core__fn__console_log(ssc__core__fn__string_literal<u8"function">(), ssc__core__fn__strict_equals(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a, ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a), ssc__core__fn__strict_equals(ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__a, ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::ssc__ts__var__b));
        ssc__ts__namespace__15d97f8e387643d1bf855b120ebfe3b6::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});

test('object-literal.ts', async () => {
  expect(await lowerFixture('object-literal.ts')).toMatchInlineSnapshot(`
    "module ts;

    import ssc;

    namespace ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42 {
      static ssc__core__type__ref ssc__ts__var__point;
      static ssc__core__type__ref ssc__ts__var__pair;
      static ssc__core__type__i32 ssc__ts__var__x;
      static ssc__core__type__ref ssc__ts__var__shorthand;
      static ssc__core__type__ref ssc__ts__var__dog;
      static ssc__core__type__ref ssc__ts__var__cat;
      static ssc__core__type__ref ssc__ts__var__options;
      static ssc__core__type__ref ssc__ts__var__nested;
      extern "C" ssc__core__type__void exit(ssc__core__type__i32 ssc__ts__var__code);
      static ssc__core__type__i32 ssc__ts__fn__sum(ssc__core__type__ref ssc__ts__var__point);
      static ssc__core__type__void ssc__ts__fn__rename(ssc__core__type__ref ssc__ts__var__animal, ssc__core__type__ref ssc__ts__var__name);
      static ssc__core__type__ref ssc__ts__fn__describe(ssc__core__type__ref ssc__ts__var__animal);
      struct ssc__ts__shape__76a1102b326949c2 { ssc__core__struct__object_header ssc__core__member__object_header; ssc__core__type__i32 ssc__ts__member__x; ssc__core__type__i32 ssc__ts__member__y; };
      inline constexpr ssc__core__struct__field ssc__ts__shape__76a1102b326949c2__fields[] = {{"x", __builtin_offsetof(ssc__ts__shape__76a1102b326949c2, ssc__ts__member__x), ssc__core__var__type_id<ssc__core__type__i32>}, {"y", __builtin_offsetof(ssc__ts__shape__76a1102b326949c2, ssc__ts__member__y), ssc__core__var__type_id<ssc__core__type__i32>}};
      inline constexpr ssc__core__struct__shape ssc__ts__shape__76a1102b326949c2__shape{{}, {}, {2, ssc__ts__shape__76a1102b326949c2__fields}, 0x76a1102b326949c2ull};
      struct ssc__ts__shape__80bdf0a5cc1c9a6f { ssc__core__struct__object_header ssc__core__member__object_header; ssc__core__type__ref ssc__ts__member__name; };
      inline constexpr ssc__core__type__u64 ssc__ts__shape__80bdf0a5cc1c9a6f__ref_offsets[] = {__builtin_offsetof(ssc__ts__shape__80bdf0a5cc1c9a6f, ssc__ts__member__name)};
      inline constexpr ssc__core__struct__field ssc__ts__shape__80bdf0a5cc1c9a6f__fields[] = {{"name", __builtin_offsetof(ssc__ts__shape__80bdf0a5cc1c9a6f, ssc__ts__member__name), ssc__core__var__type_id<ssc__core__type__ref>}};
      inline constexpr ssc__core__struct__shape ssc__ts__shape__80bdf0a5cc1c9a6f__shape{{1, ssc__ts__shape__80bdf0a5cc1c9a6f__ref_offsets}, {}, {1, ssc__ts__shape__80bdf0a5cc1c9a6f__fields}, 0x80bdf0a5cc1c9a6full};
      inline constexpr ssc__core__type__u64 ssc__ts__shape__76a1102b326949c2__descriptor__1_0__keys[] = {1, 0};
      inline constexpr ssc__core__struct__descriptor ssc__ts__shape__76a1102b326949c2__descriptor__1_0{__builtin_addressof(ssc__ts__shape__76a1102b326949c2__shape), nullptr, nullptr, ssc__core__fn__object_inspect, {2, ssc__ts__shape__76a1102b326949c2__descriptor__1_0__keys}};
      inline constexpr ssc__core__type__u64 ssc__ts__shape__76a1102b326949c2__descriptor__0_1__keys[] = {0, 1};
      inline constexpr ssc__core__struct__descriptor ssc__ts__shape__76a1102b326949c2__descriptor__0_1{__builtin_addressof(ssc__ts__shape__76a1102b326949c2__shape), nullptr, nullptr, ssc__core__fn__object_inspect, {2, ssc__ts__shape__76a1102b326949c2__descriptor__0_1__keys}};
      struct ssc__ts__shape__208f716220376f6a { ssc__core__struct__object_header ssc__core__member__object_header; ssc__core__type__ref ssc__ts__member__breed; ssc__core__type__ref ssc__ts__member__name; };
      inline constexpr ssc__core__type__u64 ssc__ts__shape__208f716220376f6a__ref_offsets[] = {__builtin_offsetof(ssc__ts__shape__208f716220376f6a, ssc__ts__member__breed), __builtin_offsetof(ssc__ts__shape__208f716220376f6a, ssc__ts__member__name)};
      inline constexpr ssc__core__struct__field ssc__ts__shape__208f716220376f6a__fields[] = {{"breed", __builtin_offsetof(ssc__ts__shape__208f716220376f6a, ssc__ts__member__breed), ssc__core__var__type_id<ssc__core__type__ref>}, {"name", __builtin_offsetof(ssc__ts__shape__208f716220376f6a, ssc__ts__member__name), ssc__core__var__type_id<ssc__core__type__ref>}};
      inline constexpr ssc__core__struct__shape ssc__ts__shape__208f716220376f6a__shape{{2, ssc__ts__shape__208f716220376f6a__ref_offsets}, {}, {2, ssc__ts__shape__208f716220376f6a__fields}, 0x208f716220376f6aull};
      inline constexpr ssc__core__type__u64 ssc__ts__shape__208f716220376f6a__descriptor__1_0__keys[] = {1, 0};
      inline constexpr ssc__core__struct__descriptor ssc__ts__shape__208f716220376f6a__descriptor__1_0{__builtin_addressof(ssc__ts__shape__208f716220376f6a__shape), nullptr, nullptr, ssc__core__fn__object_inspect, {2, ssc__ts__shape__208f716220376f6a__descriptor__1_0__keys}};
      struct ssc__ts__shape__a83c75e30b8aa0e2 { ssc__core__struct__object_header ssc__core__member__object_header; ssc__core__type__i32 ssc__ts__member__lives; ssc__core__type__ref ssc__ts__member__name; };
      inline constexpr ssc__core__type__u64 ssc__ts__shape__a83c75e30b8aa0e2__ref_offsets[] = {__builtin_offsetof(ssc__ts__shape__a83c75e30b8aa0e2, ssc__ts__member__name)};
      inline constexpr ssc__core__struct__field ssc__ts__shape__a83c75e30b8aa0e2__fields[] = {{"lives", __builtin_offsetof(ssc__ts__shape__a83c75e30b8aa0e2, ssc__ts__member__lives), ssc__core__var__type_id<ssc__core__type__i32>}, {"name", __builtin_offsetof(ssc__ts__shape__a83c75e30b8aa0e2, ssc__ts__member__name), ssc__core__var__type_id<ssc__core__type__ref>}};
      inline constexpr ssc__core__struct__shape ssc__ts__shape__a83c75e30b8aa0e2__shape{{1, ssc__ts__shape__a83c75e30b8aa0e2__ref_offsets}, {}, {2, ssc__ts__shape__a83c75e30b8aa0e2__fields}, 0xa83c75e30b8aa0e2ull};
      inline constexpr ssc__core__type__u64 ssc__ts__shape__a83c75e30b8aa0e2__descriptor__0_1__keys[] = {0, 1};
      inline constexpr ssc__core__struct__descriptor ssc__ts__shape__a83c75e30b8aa0e2__descriptor__0_1{__builtin_addressof(ssc__ts__shape__a83c75e30b8aa0e2__shape), nullptr, nullptr, ssc__core__fn__object_inspect, {2, ssc__ts__shape__a83c75e30b8aa0e2__descriptor__0_1__keys}};
      struct ssc__ts__shape__0d5ab165223eb3c9 { ssc__core__struct__object_header ssc__core__member__object_header; ssc__core__type__union ssc__ts__member__label; ssc__core__type__i32 ssc__ts__member__size; };
      inline constexpr ssc__core__type__u64 ssc__ts__shape__0d5ab165223eb3c9__union_offsets[] = {__builtin_offsetof(ssc__ts__shape__0d5ab165223eb3c9, ssc__ts__member__label)};
      inline constexpr ssc__core__struct__field ssc__ts__shape__0d5ab165223eb3c9__fields[] = {{"label", __builtin_offsetof(ssc__ts__shape__0d5ab165223eb3c9, ssc__ts__member__label), ssc__core__var__union_kind}, {"size", __builtin_offsetof(ssc__ts__shape__0d5ab165223eb3c9, ssc__ts__member__size), ssc__core__var__type_id<ssc__core__type__i32>}};
      inline constexpr ssc__core__struct__shape ssc__ts__shape__0d5ab165223eb3c9__shape{{}, {1, ssc__ts__shape__0d5ab165223eb3c9__union_offsets}, {2, ssc__ts__shape__0d5ab165223eb3c9__fields}, 0x0d5ab165223eb3c9ull};
      inline constexpr ssc__core__type__u64 ssc__ts__shape__0d5ab165223eb3c9__descriptor__1__keys[] = {1};
      inline constexpr ssc__core__struct__descriptor ssc__ts__shape__0d5ab165223eb3c9__descriptor__1{__builtin_addressof(ssc__ts__shape__0d5ab165223eb3c9__shape), nullptr, nullptr, ssc__core__fn__object_inspect, {1, ssc__ts__shape__0d5ab165223eb3c9__descriptor__1__keys}};
      struct ssc__ts__shape__cb2f883bd87ccd8c { ssc__core__struct__object_header ssc__core__member__object_header; ssc__core__type__ref ssc__ts__member__point; ssc__core__type__ref ssc__ts__member__tags; };
      inline constexpr ssc__core__type__u64 ssc__ts__shape__cb2f883bd87ccd8c__ref_offsets[] = {__builtin_offsetof(ssc__ts__shape__cb2f883bd87ccd8c, ssc__ts__member__point), __builtin_offsetof(ssc__ts__shape__cb2f883bd87ccd8c, ssc__ts__member__tags)};
      inline constexpr ssc__core__struct__field ssc__ts__shape__cb2f883bd87ccd8c__fields[] = {{"point", __builtin_offsetof(ssc__ts__shape__cb2f883bd87ccd8c, ssc__ts__member__point), ssc__core__var__type_id<ssc__core__type__ref>}, {"tags", __builtin_offsetof(ssc__ts__shape__cb2f883bd87ccd8c, ssc__ts__member__tags), ssc__core__var__type_id<ssc__core__type__ref>}};
      inline constexpr ssc__core__struct__shape ssc__ts__shape__cb2f883bd87ccd8c__shape{{2, ssc__ts__shape__cb2f883bd87ccd8c__ref_offsets}, {}, {2, ssc__ts__shape__cb2f883bd87ccd8c__fields}, 0xcb2f883bd87ccd8cull};
      inline constexpr ssc__core__type__u64 ssc__ts__shape__cb2f883bd87ccd8c__descriptor__0_1__keys[] = {0, 1};
      inline constexpr ssc__core__struct__descriptor ssc__ts__shape__cb2f883bd87ccd8c__descriptor__0_1{__builtin_addressof(ssc__ts__shape__cb2f883bd87ccd8c__shape), nullptr, nullptr, ssc__core__fn__object_inspect, {2, ssc__ts__shape__cb2f883bd87ccd8c__descriptor__0_1__keys}};
      static ssc__core__type__i32 ssc__ts__fn__sum(ssc__core__type__ref ssc__ts__var__point) {
        return ssc__core__fn__add(ssc__core__fn__field<ssc__core__type__i32>(ssc__ts__var__point, 0x76a1102b326949c2ull, __builtin_offsetof(ssc__ts__shape__76a1102b326949c2, ssc__ts__member__x), "x"), ssc__core__fn__field<ssc__core__type__i32>(ssc__ts__var__point, 0x76a1102b326949c2ull, __builtin_offsetof(ssc__ts__shape__76a1102b326949c2, ssc__ts__member__y), "y"), "i32");
      }
      static ssc__core__type__void ssc__ts__fn__rename(ssc__core__type__ref ssc__ts__var__animal, ssc__core__type__ref ssc__ts__var__name) {
        (ssc__core__fn__field<ssc__core__type__ref>(ssc__ts__var__animal, 0x80bdf0a5cc1c9a6full, __builtin_offsetof(ssc__ts__shape__80bdf0a5cc1c9a6f, ssc__ts__member__name), "name") = ssc__ts__var__name);
      }
      static ssc__core__type__ref ssc__ts__fn__describe(ssc__core__type__ref ssc__ts__var__animal) {
        return ssc__core__fn__field<ssc__core__type__ref>(ssc__ts__var__animal, 0x80bdf0a5cc1c9a6full, __builtin_offsetof(ssc__ts__shape__80bdf0a5cc1c9a6f, ssc__ts__member__name), "name");
      }
      void ssc__core__fn__034ed69556374db88ff0a9da7b12df42() {
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point = [&] { ssc__ts__shape__76a1102b326949c2* object = reinterpret_cast<ssc__ts__shape__76a1102b326949c2*>(ssc__core__fn__allocate_object(sizeof(ssc__ts__shape__76a1102b326949c2), __builtin_addressof(ssc__ts__shape__76a1102b326949c2__descriptor__1_0))); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__y), ssc__core__type__i32{2}); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__x), ssc__core__type__i32{1}); return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }();
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__pair = ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point;
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__x = ssc__core__type__i32{10};
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__shorthand = [&] { ssc__ts__shape__76a1102b326949c2* object = reinterpret_cast<ssc__ts__shape__76a1102b326949c2*>(ssc__core__fn__allocate_object(sizeof(ssc__ts__shape__76a1102b326949c2), __builtin_addressof(ssc__ts__shape__76a1102b326949c2__descriptor__0_1))); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__x), ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__x); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__y), ssc__core__type__i32{20}); return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }();
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__dog = [&] { ssc__ts__shape__208f716220376f6a* object = reinterpret_cast<ssc__ts__shape__208f716220376f6a*>(ssc__core__fn__allocate_object(sizeof(ssc__ts__shape__208f716220376f6a), __builtin_addressof(ssc__ts__shape__208f716220376f6a__descriptor__1_0))); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__name), ssc__core__fn__string_literal<u8"rex">()); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__breed), ssc__core__fn__string_literal<u8"pug">()); return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }();
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__cat = [&] { ssc__ts__shape__a83c75e30b8aa0e2* object = reinterpret_cast<ssc__ts__shape__a83c75e30b8aa0e2*>(ssc__core__fn__allocate_object(sizeof(ssc__ts__shape__a83c75e30b8aa0e2), __builtin_addressof(ssc__ts__shape__a83c75e30b8aa0e2__descriptor__0_1))); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__lives), ssc__core__type__i32{9}); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__name), ssc__core__fn__string_literal<u8"tom">()); return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }();
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__options = [&] { ssc__ts__shape__0d5ab165223eb3c9* object = reinterpret_cast<ssc__ts__shape__0d5ab165223eb3c9*>(ssc__core__fn__allocate_object(sizeof(ssc__ts__shape__0d5ab165223eb3c9), __builtin_addressof(ssc__ts__shape__0d5ab165223eb3c9__descriptor__1))); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__size), ssc__core__type__i32{3}); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__label), ssc__core__type__union(ssc__core__var__undefined)); return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }();
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__nested = [&] { ssc__ts__shape__cb2f883bd87ccd8c* object = reinterpret_cast<ssc__ts__shape__cb2f883bd87ccd8c*>(ssc__core__fn__allocate_object(sizeof(ssc__ts__shape__cb2f883bd87ccd8c), __builtin_addressof(ssc__ts__shape__cb2f883bd87ccd8c__descriptor__0_1))); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__point), ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point); ssc__core__fn__construct(__builtin_addressof(object->ssc__ts__member__tags), ssc__core__fn__array_of<ssc__core__type__ref>(ssc__core__fn__string_literal<u8"a">())); return ssc__core__type__ref(__builtin_addressof(object->ssc__core__member__object_header)); }();
        ssc__core__fn__console_log(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point, ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__pair, ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__shorthand, ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__options);
        ssc__core__fn__console_log(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__fn__sum(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point), ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__fn__sum(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__pair), ssc__core__fn__strict_equals(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point, ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__pair));
        (ssc__core__fn__field<ssc__core__type__i32>(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__point, 0x76a1102b326949c2ull, __builtin_offsetof(ssc__ts__shape__76a1102b326949c2, ssc__ts__member__x), "x") = ssc__core__type__i32{5});
        ssc__core__fn__console_log(ssc__core__fn__field<ssc__core__type__i32>(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__pair, 0x76a1102b326949c2ull, __builtin_offsetof(ssc__ts__shape__76a1102b326949c2, ssc__ts__member__x), "x"));
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__fn__rename(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__dog, ssc__core__fn__string_literal<u8"max">());
        ssc__core__fn__console_log(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__fn__describe(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__dog), ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__fn__describe(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__cat), ssc__core__fn__field<ssc__core__type__ref>(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__dog, 0x208f716220376f6aull, __builtin_offsetof(ssc__ts__shape__208f716220376f6a, ssc__ts__member__name), "name"), ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__dog);
        ssc__core__fn__console_log(ssc__core__fn__field<ssc__core__type__union>(ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__options, 0x0d5ab165223eb3c9ull, __builtin_offsetof(ssc__ts__shape__0d5ab165223eb3c9, ssc__ts__member__label), "label"), ssc__core__fn__string_literal<u8"object">(), ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::ssc__ts__var__nested);
        ssc__ts__namespace__034ed69556374db88ff0a9da7b12df42::exit(ssc__core__type__i32{0});
      }
    }"
  `);
});
