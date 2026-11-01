const s: string = '한👍a';
const b: bstring = bstring('한👍a');
const joined: bstring = b + bstring('!');
const lone: string = '\uD800';

console.log(s.length, b.length, joined, joined.length);
console.log(string(b) === s, bstring(s) === b, bstring('a') < bstring('b'), bstring('b') <= bstring('a'));
console.log(s.bytes().length, b.bytes().length, bstring(b.bytes()) === b);
console.log(string([u8(0xf0), u8(0x9f), u8(0x91), u8(0x8d)]), string([u16(0xd83d), u16(0xdc4d)]), bstring([u8(0x61)]));
console.log(lone.length, lone + 'x');
process.stdout.write(b);
process.stdout.write(' ');
process.stdout.write(s);
process.stdout.write('\n');
