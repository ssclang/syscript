import { Console } from 'console';
import util from 'util';

export function logSuccess(message: string, log = console) {
  log.log(util.styleText('green', message, { stream: process.stdout }));
}

export function logWarn(message: string, log = console) {
  log.warn(util.styleText('yellow', message, { stream: process.stderr }));
}

export function logError(message: string, log = console) {
  log.error(util.styleText('red', message, { stream: process.stderr }));
}

export function printLine() {
  console.log('─'.repeat(50));
}

export const debugConsole = new Console({
  stdout: process.stderr,
  stderr: process.stderr,
});
