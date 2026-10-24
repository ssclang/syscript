declare function exit(code: i32): void;

const integer: i32 = 5 as const;
const float: f64 = (0.5 as const);
const text: string = 'ab' as const;
const letter: char = 'A' as const;

console.log(integer, float, text, letter);
exit(0);
