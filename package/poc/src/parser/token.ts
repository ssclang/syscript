import { SourceFileSpan } from '~/parser/ast.js';

export const reservedKeywordGroup = {
  variable: ['val', 'var'],
  function: ['fn', 'inline'],
  type: ['type', 'interface', 'as'],
  module: ['import', 'export'],
  control: ['if', 'else', 'loop', 'of', 'return', 'break', 'continue'],
  literal: ['none', 'true', 'false'],
  accessibility: ['public', 'static'],
  accessor: ['self', 'this'],
} as const;

export const reservedKeywords = Object.values(reservedKeywordGroup).flat();

export type ReservedKeyword = (typeof reservedKeywords)[number];

export type VariableDeclarationKeyword = (typeof reservedKeywordGroup.variable)[number];

export const operators = ['=', '+', '-', '*', '/', '.'] as const;

export type Operator = (typeof operators)[number];

export const brackets = ['(', ')', '{', '}', '[', ']'] as const;

export type Bracket = (typeof brackets)[number];

export type Token =
  | { kind: 'keyword'; text: ReservedKeyword; span: SourceFileSpan }
  | { kind: 'identifier'; text: string; span: SourceFileSpan }
  | { kind: 'number'; text: string; span: SourceFileSpan }
  | { kind: 'string'; text: string; span: SourceFileSpan }
  | { kind: 'operator'; text: Operator; span: SourceFileSpan }
  | { kind: 'bracket'; text: Bracket; span: SourceFileSpan }
  | { kind: 'comma'; text: ','; span: SourceFileSpan }
  | { kind: 'statement-end'; text: string; span: SourceFileSpan }
  | { kind: 'file-end'; text: ''; span: SourceFileSpan };
