import util from 'util';

/** 출력 스트림이 터미널일 때만 색을 넣는다. 리다이렉트나 `NO_COLOR`면 글자만 나간다. */
export function logSuccess(message: string) {
  console.log(util.styleText('green', message, { stream: process.stdout }));
}

export function logWarn(message: string) {
  console.warn(util.styleText('yellow', message, { stream: process.stderr }));
}

export function logError(message: string) {
  console.error(util.styleText('red', message, { stream: process.stderr }));
}

export function printLine() {
  console.log('─'.repeat(50));
}
