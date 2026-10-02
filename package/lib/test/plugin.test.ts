/*
 * 에디터 없이 플러그인을 검증한다. tsserver를 띄우는 대신 LanguageService를 직접
 * 만들어 프록시에 통과시킨다.
 */

import path from 'path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import init from '~/plugin/index.js';

const preludePath = path.join(import.meta.dirname, '..', 'src', 'prelude', 'prelude.d.ts');
const entryPath = '/virtual/main.ts';

function createService(source: string) {
  const files = new Map([
    [entryPath, source],
    [preludePath, ts.sys.readFile(preludePath) ?? ''],
  ]);

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [...files.keys()],
    getScriptVersion: () => '1',
    getScriptSnapshot: (fileName) => {
      const text = files.get(fileName) ?? ts.sys.readFile(fileName);

      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => '/virtual',
    getCompilationSettings: () => ({ noLib: true, strict: true, target: ts.ScriptTarget.ESNext }),
    getDefaultLibFileName: () => '',
    fileExists: (fileName) => files.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) => files.get(fileName) ?? ts.sys.readFile(fileName),
  };

  const service = ts.createLanguageService(host);
  const plugin = init({ typescript: ts });

  return plugin.create({ languageService: service } as ts.server.PluginCreateInfo);
}

function syscriptErrors(source: string) {
  return createService(source)
    .getSemanticDiagnostics(entryPath)
    .filter((d) => d.source === 'syscript')
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
}

test('tsc가 못 잡는 숫자 타입 혼용을 잡는다', () => {
  const errors = syscriptErrors(`
    export function f(a: f64): void {
      const x: i32 = a;
    }
  `);

  expect(errors).toMatchInlineSnapshot(`
    [
      "'f64' 값을 'i32'에 넣을 수 없습니다. 명시적으로 변환하세요.",
    ]
  `);
});

test('같은 타입끼리는 통과한다', () => {
  const errors = syscriptErrors(`
    export function f(a: i32): void {
      const x: i32 = a;
    }
  `);

  expect(errors).toEqual([]);
});

test('함수 반환 타입도 따라간다', () => {
  const errors = syscriptErrors(`
    declare function ratio(): f64;

    export function f(): void {
      const x: i32 = ratio();
    }
  `);

  expect(errors).toMatchInlineSnapshot(`
    [
      "'f64' 값을 'i32'에 넣을 수 없습니다. 명시적으로 변환하세요.",
    ]
  `);
});
