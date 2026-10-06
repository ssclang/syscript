// import { assert } from '@syscript/share/util';
// import { spawnSync } from 'child_process';
// import fs from 'fs/promises';
// import path from 'path';
// import util from 'util';
// import { SscAllType } from '~/sys/syscript-type.js';
// import { File } from '~/util/file.js';

// /** `dump.c`가 내는 JSON. 형식은 그쪽과 같이 바꾼다. */
// type DumpType = {
//   kind: string;
//   spelling: string;
//   const: boolean;
//   pointee?: DumpType;
// };

// type DumpFunction = {
//   name: string;
//   line: number;
//   invalid: boolean;
//   variadic: boolean;
//   returns: DumpType;
//   params: { name: string; type: DumpType }[];
// };

// type Dump = {
//   functions: DumpFunction[];
// };

// const help = 'ssc-bindgen <header-path> [--out <d.ts-path>]';
// const dumpSource = path.join(import.meta.dirname, 'dump.c');
// const dumpTool = path.join(process.cwd(), '.ssc/tools/bindgen-dump');

// /**
//  * libclang의 정규 타입 종류에서 syscript 타입으로. 64비트 대상만 지원하므로 `int`는 `i32`로
//  * 고정된다. `long`은 Windows에서 폭이 달라 아직 넣지 않았다. 표에 없는 타입을 쓰는 함수는
//  * 틀린 바인딩을 내는 대신 건너뛰고 이유를 알린다.
//  */
// const primitiveTypes: Partial<Record<string, SscAllType>> = {
//   Void: 'void',
//   Bool: 'boolean',
//   SChar: 'i8',
//   UChar: 'u8',
//   Short: 'i16',
//   UShort: 'u16',
//   Int: 'i32',
//   UInt: 'u32',
//   LongLong: 'i64',
//   ULongLong: 'u64',
//   Float: 'f32',
//   Double: 'f64',
// };

// async function main() {
//   const { values, positionals } = util.parseArgs({
//     allowPositionals: true,
//     options: {
//       out: { type: 'string' },
//     },
//   });
//   const [headerPath] = positionals;

//   assert(positionals.length === 1, help);
//   assert(headerPath, help);

//   const header = path.resolve(headerPath);

//   assert(await File.exists(header, 'file'), `header not found: ${header}`);

//   const resourceDir = clangResourceDir();

//   await buildDumpTool(llvmPrefix(resourceDir));

//   const dump = runDumpTool(header, resourceDir);
//   const outPath = values.out && path.resolve(values.out);
//   const { dts, skipped } = generate(dump, header, outPath);

//   for (const line of skipped) {
//     console.error(`skipped ${line}`);
//   }

//   if (outPath) {
//     await fs.writeFile(outPath, dts);
//     return;
//   }

//   process.stdout.write(dts);
// }

// function clangResourceDir() {
//   const { stdout, status } = spawnSync('clang', ['-print-resource-dir'], { encoding: 'utf8' });

//   assert(status === 0, 'clang -print-resource-dir failed');

//   return stdout.trim();
// }

// /** `<prefix>/lib/clang/<버전>`에서 `<prefix>`를 뗀다. libclang은 그 아래 `lib`, `include`에 있다. */
// function llvmPrefix(resourceDir: string) {
//   const marker = `${path.sep}lib${path.sep}clang${path.sep}`;
//   const index = resourceDir.lastIndexOf(marker);

//   assert(index >= 0, `unexpected clang resource dir: ${resourceDir}`);

//   return resourceDir.slice(0, index);
// }

// /** 도우미는 설치된 clang과 같은 libclang으로 한 번 빌드해 두고, 소스가 바뀌면 다시 빌드한다. */
// async function buildDumpTool(prefix: string) {
//   const [source, tool] = await Promise.all([
//     fs.stat(dumpSource),
//     fs.stat(dumpTool).catch(() => undefined),
//   ]);

//   if (tool && tool.mtimeMs >= source.mtimeMs) {
//     return;
//   }

//   await fs.mkdir(path.dirname(dumpTool), { recursive: true });

//   run('clang', [
//     '-std=gnu23',
//     '-O1',
//     dumpSource,
//     `-I${path.join(prefix, 'include')}`,
//     `-L${path.join(prefix, 'lib')}`,
//     '-lclang',
//     `-Wl,-rpath,${path.join(prefix, 'lib')}`,
//     '-o',
//     dumpTool,
//   ]);
// }

// function runDumpTool(header: string, resourceDir: string) {
//   const { stdout, stderr, status } = spawnSync(dumpTool, [header, resourceDir], {
//     encoding: 'utf8',
//     maxBuffer: 256 * 1024 * 1024,
//   });

//   if (status !== 0) {
//     process.stderr.write(stderr);
//     throw new Error(`bindgen dump failed (exit ${status}): ${header}`);
//   }

//   return JSON.parse(stdout) as Dump;
// }

// function generate(dump: Dump, header: string, outPath: string | undefined) {
//   // `ssc:include`의 따옴표 경로는 .d.ts 위치 기준이다
//   const includePath =
//     outPath ? path.relative(path.dirname(outPath), header) : path.basename(header);
//   const lines = [`// ssc:include:"${includePath.split(path.sep).join('/')}"`, ''];
//   const skipped: string[] = [];

//   for (const fn of dump.functions) {
//     const reason = unsupportedReason(fn);

//     if (reason) {
//       skipped.push(`${fn.name} (${header}:${fn.line}): ${reason}`);
//       continue;
//     }

//     const params = fn.params.map((p, i) => `${p.name || `arg${i}`}: ${toSysType(p.type)}`);

//     lines.push(`declare function ${fn.name}(${params.join(', ')}): ${toSysType(fn.returns)};`);
//   }

//   return { dts: `${lines.join('\n')}\n`, skipped };
// }

// function unsupportedReason(fn: DumpFunction) {
//   if (fn.invalid) {
//     return 'invalid declaration';
//   }

//   if (fn.variadic) {
//     return 'variadic function';
//   }

//   const unknown = [fn.returns, ...fn.params.map((p) => p.type)].find(
//     (t) => primitiveTypes[t.kind] === undefined,
//   );

//   return unknown && `not implemented C type: '${unknown.spelling}' (${unknown.kind})`;
// }

// function toSysType(type: DumpType) {
//   const sscType = primitiveTypes[type.kind];

//   assert(sscType, `not implemented C type: '${type.spelling}' (${type.kind})`);

//   return sscType;
// }

// /** 진단은 clang이 그대로 내보내는 게 읽기 좋다. 우리는 짧게만 던진다. */
// function run(command: string, args: readonly string[]) {
//   const { status } = spawnSync(command, args, { stdio: 'inherit' });

//   if (status !== 0) {
//     throw new Error(`${[command, ...args].join(' ')} failed (exit ${status})`);
//   }
// }

// await main();
