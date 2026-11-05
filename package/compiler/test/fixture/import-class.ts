import { Box } from './import-class-lib.js';

const box = new Box(21);
box.value = box.value + 1;
console.log(box.double(), box);
