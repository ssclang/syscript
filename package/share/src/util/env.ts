import { AnyString } from '~/type.js';
import { assert } from '~/util/assert.js';
import { TypeUtil } from '~/util/type.js';

type EnvKey = 'NODE_ENV';

export class Env {
  static _log = console;
  static readonly nodeEnvs = ['development', 'production', 'test'] as const;

  static {
    Env.log('NODE_ENV');
  }

  static get<T extends string>(key: AnyString<EnvKey>): AnyString<T> | undefined {
    return process.env[key];
  }

  static value<T extends string>(key: EnvKey): AnyString<T> {
    const value = Env.get(key);

    assert(value, key);

    return value;
  }

  static nodeEnv() {
    const nodeEnv = Env.value('NODE_ENV');

    assert(TypeUtil.includes(Env.nodeEnvs, nodeEnv));

    return nodeEnv;
  }

  static isDev() {
    return this.nodeEnv() === 'development';
  }

  static isProd() {
    return this.nodeEnv() === 'production';
  }

  static isTest() {
    return this.nodeEnv() === 'test';
  }

  static log(key: EnvKey, required?: true): void;

  static log(key: AnyString<EnvKey>, required: false): void;

  static log(key: EnvKey, required = true) {
    const value = required ? Env.value(key) : Env.get(key);
    Env._log.log(`${key}=${value}`);
  }
}
