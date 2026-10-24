declare function exit(code: i32): void;

function greet(name: string): string {
  return 'hello, ' + name + '\n';
}

process.stdout.write(greet('syscript'));
process.stdout.write('한글 ' + char(0x1f44d) + '\n');
process.stderr.write('warning\n');
exit(0);
