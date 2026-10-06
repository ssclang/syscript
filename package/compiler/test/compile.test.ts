import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

test('main.ts', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));
  const idJsonPath = path.join(import.meta.dirname, 'id.json');
  const manager = await SscManager.init({ outDir, profile: 'test', idJsonPath });
  const { modules } = await manager.buildManager
    .compile(path.join(fixtureDir, 'main.ts'))
    .then(async (r) => {
      await manager.flush();
      return r;
    });

  await fs.rm(outDir, { recursive: true, force: true });

  expect(modules.map((m) => m.output.renderC('<buildDir>')).join('\n\n')).toMatchInlineSnapshot(`
    "// /var/home/lsh/lsh/project/syscript/package/compiler/test/fixture/add.ts

    // include
    #include "<buildDir>/module/header/9c1df5d27c7c493a9c43820500c674d4.h"
    // /include

    // #pragma STDC FP_CONTRACT OFF
    // #pragma clang fp contract(off)

    // declaration
    ssc__type__i32 ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_fn__add(ssc__type__i32, ssc__type__i32);
    void ssc__module_bfd7f01980af48b0ba39d6c89a4b391b(void);
    // /declaration

    // definition
    ssc__type__i32 ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_fn__add(ssc__type__i32 ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_var_1__a, ssc__type__i32 ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_var_2__b) {
      return ssc__fn__add_i32(ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_var_1__a, ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_var_2__b);
    }

    void ssc__module_bfd7f01980af48b0ba39d6c89a4b391b(void) {
    }
    // /definition

    // /var/home/lsh/lsh/project/syscript/package/compiler/test/fixture/main.ts

    // include
    #include "<buildDir>/module/header/9c1df5d27c7c493a9c43820500c674d4.h"
    #include "<buildDir>/module/header/1e6e8b8df0c640198e243bda7657f43f.h"
    // /include

    // #pragma STDC FP_CONTRACT OFF
    // #pragma clang fp contract(off)

    // declaration
    static ssc__type__i64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__date_now(void);
    static ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__sum(ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__countdown(ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__nanIsFalsy(void);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__flags(ssc__type__i32, ssc__type__boolean);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__logic(ssc__type__i32, ssc__type__boolean);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__oddSum(ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__literals(void);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__grouped(ssc__type__i32, ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__negate(ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__fib(ssc__type__i32);
    static ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isEven(ssc__type__i32);
    static ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isOdd(ssc__type__i32);
    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__main(void);
    ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__probe(ssc__type__f64);
    static ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__noExport(ssc__type__f64);
    ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__plainNumber(ssc__type__f64);
    ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__plainBoolean(ssc__type__boolean);
    ssc__type__i32 putchar(ssc__type__i32);
    ssc__type__i32 ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_fn__add(ssc__type__i32, ssc__type__i32);
    ssc__type__i32 abs(ssc__type__i32);
    void ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded(void);
    // /declaration

    // definition
    static ssc__type__i64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__date_now(void) {
      return ssc__fn__div_i64(clock(), (ssc__type__i64)1000uwb);
    }

    static ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_1__value) {
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_2__div = (ssc__type__i32)1000000000uwb;
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_3__started = (ssc__type__i32)0uwb;
      for (ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_4__i = (ssc__type__i32)0uwb; (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_4__i < (ssc__type__i32)10uwb); ssc__fn__increment_postfix_i32((&ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_4__i))) {
        const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_5__digit = ssc__fn__div_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_1__value, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_2__div);
        const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_6__rest = ssc__fn__rem_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_5__digit, (ssc__type__i32)10uwb);
        if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_6__rest != (ssc__type__i32)0uwb)) {
          (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_3__started = (ssc__type__i32)1uwb);
        } else if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_4__i == (ssc__type__i32)9uwb)) {
          (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_3__started = (ssc__type__i32)1uwb);
        }
        if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_3__started == (ssc__type__i32)1uwb)) {
          putchar(ssc__fn__add_i32((ssc__type__i32)48uwb, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_6__rest));
        }
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_2__div = ssc__fn__div_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_2__div, (ssc__type__i32)10uwb));
      }
      return putchar((ssc__type__i32)10uwb);
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__sum(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_7__n) {
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_8__total = (ssc__type__i32)0uwb;
      for (ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_9__i = (ssc__type__i32)0uwb; (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_9__i < ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_7__n); ssc__fn__increment_postfix_i32((&ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_9__i))) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_8__total = ssc__module_bfd7f01980af48b0ba39d6c89a4b391b_fn__add(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_8__total, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_9__i));
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_8__total;
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__countdown(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_10__n) {
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_11__count = (ssc__type__i32)0uwb;
      while ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_10__n > (ssc__type__i32)0uwb)) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_11__count = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_11__count, (ssc__type__i32)1uwb));
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_10__n = ssc__fn__sub_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_10__n, (ssc__type__i32)1uwb));
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_11__count;
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__nanIsFalsy(void) {
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_12__zero = 0.0;
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_13__nan = (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_12__zero / ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_12__zero);
      if (ssc__fn__truthy_f64(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_13__nan)) {
        return (ssc__type__i32)1uwb;
      }
      return (ssc__type__i32)0uwb;
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__flags(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_14__n, ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_15__seen) {
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total = (ssc__type__i32)0uwb;
      if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_14__n != (ssc__type__i32)0uwb)) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total, (ssc__type__i32)1uwb));
      }
      if ((!ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_15__seen)) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total, (ssc__type__i32)2uwb));
      }
      if (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_15__seen) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total, (ssc__type__i32)4uwb));
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_16__total;
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__logic(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_17__n, ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_18__seen) {
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total = (ssc__type__i32)0uwb;
      if (((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_17__n > (ssc__type__i32)0uwb) && ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_18__seen)) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total, (ssc__type__i32)1uwb));
      }
      if (((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_17__n > (ssc__type__i32)100uwb) || ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_18__seen)) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total, (ssc__type__i32)2uwb));
      }
      if ((!((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_17__n > (ssc__type__i32)0uwb) && ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_18__seen))) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total, (ssc__type__i32)4uwb));
      }
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_20__nan = (0.0 / 0.0);
      if ((ssc__fn__truthy_f64(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_20__nan) || (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_17__n != (ssc__type__i32)0uwb))) {
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total, (ssc__type__i32)8uwb));
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_19__total;
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__oddSum(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_21__n) {
      ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_22__total = (ssc__type__i32)0uwb;
      for (ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_23__i = (ssc__type__i32)0uwb; (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_23__i < (ssc__type__i32)100uwb); ssc__fn__increment_postfix_i32((&ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_23__i))) {
        if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_23__i >= ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_21__n)) {
          break;
        }
        if ((ssc__fn__rem_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_23__i, (ssc__type__i32)2uwb) == (ssc__type__i32)0uwb)) {
          continue;
        }
        (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_22__total = ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_22__total, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_23__i));
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_22__total;
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__literals(void) {
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_24__hex = (ssc__type__i32)255uwb;
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_25__bin = (ssc__type__i32)10uwb;
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_26__oct = (ssc__type__i32)15uwb;
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_27__exp = (ssc__type__i32)1000uwb;
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_28__under = (ssc__type__i32)1000uwb;
      return ssc__fn__add_i32(ssc__fn__add_i32(ssc__fn__add_i32(ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_24__hex, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_25__bin), ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_26__oct), ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_27__exp), ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_28__under);
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__grouped(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_29__a, ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_30__b) {
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_31__scaled = ssc__fn__mul_i32(ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_29__a, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_30__b), (ssc__type__i32)2uwb);
      return ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_31__scaled, ssc__fn__rem_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_29__a, ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_30__b, (ssc__type__i32)1uwb)));
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__negate(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_32__x) {
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_33__twice = ssc__fn__sub_i32((ssc__type__i32)0uwb, ssc__fn__sub_i32((ssc__type__i32)0uwb, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_32__x));
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_34__parens = ssc__fn__sub_i32((ssc__type__i32)0uwb, ssc__fn__sub_i32((ssc__type__i32)0uwb, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_32__x));
      return ssc__fn__add_i32(ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_33__twice, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_34__parens), ssc__fn__sub_i32((ssc__type__i32)0uwb, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_32__x));
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__fib(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_35__n) {
      if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_35__n < (ssc__type__i32)2uwb)) {
        return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_35__n;
      }
      return ssc__fn__add_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__fib(ssc__fn__sub_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_35__n, (ssc__type__i32)1uwb)), ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__fib(ssc__fn__sub_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_35__n, (ssc__type__i32)2uwb)));
    }

    static ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isEven(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_36__n) {
      if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_36__n == (ssc__type__i32)0uwb)) {
        return (ssc__type__i32)1uwb;
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isOdd(ssc__fn__sub_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_36__n, (ssc__type__i32)1uwb));
    }

    static ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isOdd(ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_37__n) {
      if ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_37__n == (ssc__type__i32)0uwb)) {
        return (ssc__type__i32)0uwb;
      }
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isEven(ssc__fn__sub_i32(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_37__n, (ssc__type__i32)1uwb));
    }

    ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__main(void) {
      const ssc__type__i32 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_38__total = abs(ssc__fn__sub_i32((ssc__type__i32)0uwb, ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__sum((ssc__type__i32)5uwb)));
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_38__total);
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__fib((ssc__type__i32)20uwb));
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__isEven((ssc__type__i32)10uwb));
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__nanIsFalsy());
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__flags((ssc__type__i32)1uwb, true));
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__logic((ssc__type__i32)1uwb, true));
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__console_log(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__oddSum((ssc__type__i32)10uwb));
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_38__total;
    }

    ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__probe(ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_39__a) {
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_40__x = ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_39__a;
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_40__x;
    }

    static ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__noExport(ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_41__a) {
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_42__x = ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_41__a;
      return ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_42__x;
    }

    ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__plainNumber(ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_43__a) {
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_44__num1 = (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_43__a * 2.0);
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_45__num2 = (ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_43__a * 4.0);
      const ssc__type__f64 ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_46__num3 = 6.0;
      return (((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_44__num1 + ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_45__num2) + ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_46__num3) + 8.0);
    }

    ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__plainBoolean(ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_47__a) {
      const ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_48__bool1 = (!ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_47__a);
      const ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_49__bool2 = (!ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_48__bool1);
      const ssc__type__boolean ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_50__bool3 = true;
      return ((ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_48__bool1 != ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_49__bool2) == ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_var_50__bool3);
    }

    void ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded(void) {
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__date_now();
      ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__noExport(0.0);
      exit(ssc__module_ed3a30c7ebe849d2b1e6f878e9a1eded_fn__main());
    }
    // /definition"
  `);
});
