declare function exit(code: i32): void;

let total: i32 = 1;
const step: i32 = 2;
let later: i32;

function add(n: i32): void {
  total = total + n;
}

add(step);
later = total + step;
add(later);
exit(total);
