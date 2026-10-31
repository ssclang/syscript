declare function exit(code: i32): void;

const name: string = 'syscript';
const count: i32 = i32(3);
const ratio: f64 = 0.5;
const emoji: char = char(0x1f44d);
const flag: boolean = true;
const value: i32 | undefined = undefined;

console.log(`plain`);
console.log(`hello, ${name}!`);
console.log(`${count} items`);
console.log(`ratio=${ratio}, ok=${flag}, value=${value}`);
console.log(`${emoji}${emoji}`);
console.log(`sum=${count + i32(1)}, nested=${`[${name}]`}`);
console.log(`한글 ${name} \${escaped} \`tick\``);
console.log(`line1
line2`);
exit(i32(0));
