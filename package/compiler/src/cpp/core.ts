export type CppCoreFunctionName = (typeof cppCoreFunctionNames)[number];
export const cppCoreFunctionNames = [
  // region number
  'ssc__core__fn__add',
  'ssc__core__fn__sub',
  'ssc__core__fn__mul',
  'ssc__core__fn__div',
  'ssc__core__fn__rem',
  'ssc__core__fn__add_wrap',
  'ssc__core__fn__sub_wrap',
  'ssc__core__fn__mul_wrap',
  'ssc__core__fn__bitwise_and',
  'ssc__core__fn__bitwise_or',
  'ssc__core__fn__bitwise_xor',
  'ssc__core__fn__bitwise_not',
  'ssc__core__fn__shift_left',
  'ssc__core__fn__shift_right',
  'ssc__core__fn__unsigned_shift_right',
  'ssc__core__fn__increment_prefix',
  'ssc__core__fn__increment_postfix',
  'ssc__core__fn__decrement_prefix',
  'ssc__core__fn__decrement_postfix',
  'ssc__core__fn__char',

  // region string
  'ssc__core__fn__string_concat',
  'ssc__core__fn__string_compare',
  'ssc__core__fn__string_length',
  'ssc__core__fn__to_string',

  // region equality and truthiness
  'ssc__core__fn__strict_equals',
  'ssc__core__fn__truthy_union',
  'ssc__core__fn__truthy_ref',
  'ssc__core__fn__truthy_f32',
  'ssc__core__fn__truthy_f64',

  // region union
  'ssc__core__fn__typeof',
  'ssc__core__fn__union_as',
  'ssc__core__fn__union_as_union',
  'ssc__core__fn__union_is_undefined',
  'ssc__core__fn__union_is_null',
  'ssc__core__fn__union_to_undefined',
  'ssc__core__fn__union_to_null',
  'ssc__core__fn__union_to_boolean',
  'ssc__core__fn__union_to_number',
  'ssc__core__fn__union_to_ref',

  // region closure
  'ssc__core__fn__box',
  'ssc__core__fn__box_value',
  'ssc__core__fn__closure',
  'ssc__core__fn__call',
  'ssc__core__fn__function_value',

  // region array
  'ssc__core__fn__array_of',
  'ssc__core__fn__array_get',
  'ssc__core__fn__array_set',
  'ssc__core__fn__array_length',
  'ssc__core__fn__array_push',
  'ssc__core__fn__array_pop',
  'ssc__core__fn__array_for_each',
  'ssc__core__fn__array_map',
  'ssc__core__fn__array_filter',
  'ssc__core__fn__array_reduce',
  'ssc__core__fn__array_find',
  'ssc__core__fn__array_some',
  'ssc__core__fn__array_every',
  'ssc__core__fn__array_index_of',

  // region object
  'ssc__core__fn__allocate_object',
  'ssc__core__fn__construct',
  'ssc__core__fn__field',
  'ssc__core__fn__object_inspect',

  // region tdz
  'ssc__core__fn__throw_if_tdz',

  // region output
  'ssc__core__fn__write_stdout',
  'ssc__core__fn__write_stderr',
  'ssc__core__fn__console_log',
  'ssc__core__fn__console_error',
] as const;
