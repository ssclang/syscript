import { expect, test } from 'vitest';
import { tokenize } from '~/parser/lexer.js';

function tokenTexts(source: string) {
  return tokenize(source).map((token) => [token.kind, token.text]);
}

test('variable declaration', () => {
  expect(tokenTexts('val a = 7')).toEqual([
    ['keyword', 'val'],
    ['identifier', 'a'],
    ['operator', '='],
    ['number', '7'],
  ]);
});

test('newline after value ends statement', () => {
  expect(tokenTexts('val a = 7\nstd.out(a)')).toEqual([
    ['keyword', 'val'],
    ['identifier', 'a'],
    ['operator', '='],
    ['number', '7'],
    ['expression-end', '\n'],
    ['identifier', 'std'],
    ['operator', '.'],
    ['identifier', 'out'],
    ['bracket', '('],
    ['identifier', 'a'],
    ['bracket', ')'],
  ]);
});

test('newline after operator ends expression', () => {
  expect(tokenTexts('val a = 1 +\n2')).toEqual([
    ['keyword', 'val'],
    ['identifier', 'a'],
    ['operator', '='],
    ['number', '1'],
    ['operator', '+'],
    ['expression-end', '\n'],
    ['number', '2'],
  ]);
});

test('newline inside parentheses is ignored', () => {
  expect(tokenTexts('std.out(\na\n)')).toEqual([
    ['identifier', 'std'],
    ['operator', '.'],
    ['identifier', 'out'],
    ['bracket', '('],
    ['identifier', 'a'],
    ['bracket', ')'],
  ]);
});

test('token span', () => {
  expect(tokenize('val count = 1')[1]).toEqual({
    kind: 'identifier',
    text: 'count',
    span: { start: 4, end: 9 },
  });
});

test('string', () => {
  expect(tokenTexts(`'hello'`)).toEqual([['string', 'hello']]);
});

test('string escapes', () => {
  expect(tokenTexts(String.raw`'it\'s \$ C:\\path \n\t\r\0'`)).toEqual([
    ['string', "it's $ C:\\path \n\t\r\0"],
  ]);
});

test('string unicode escape', () => {
  expect(tokenTexts(String.raw`'\u{AC00}'`)).toEqual([['string', '가']]);
  expect(tokenTexts(String.raw`'\u{0001F600}'`)).toEqual([['string', '😀']]);
});

test('multiline string', () => {
  expect(tokenTexts(`'a\nb'`)).toEqual([['string', 'a\nb']]);
});

test('string span is in bytes', () => {
  expect(tokenize(`'한'`)[0]?.span).toEqual({ start: 0, end: 5 });
});

test('string errors', () => {
  expect(() => tokenize(`'abc`)).toThrow('unterminated string');
  expect(() => tokenize(String.raw`'\a'`)).toThrow('unknown escape');
  expect(() => tokenize(String.raw`'\u{D800}'`)).toThrow('invalid unicode escape');
  expect(() => tokenize(`'\${x}'`)).toThrow('not implemented');
});

test('bracket errors', () => {
  expect(() => tokenize('(}')).toThrow('unmatched');
  expect(() => tokenize(')')).toThrow('unmatched');
  expect(() => tokenize('(')).toThrow('unclosed');
});

test('newline inside braces ends expression', () => {
  expect(tokenTexts('{\na\n}')).toEqual([
    ['bracket', '{'],
    ['expression-end', '\n'],
    ['identifier', 'a'],
    ['expression-end', '\n'],
    ['bracket', '}'],
  ]);
});
