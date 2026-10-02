import { assert } from './assert.js';

export class Url {
  static parse(url: string) {
    const urlObject = new URL(url);
    const protocol = urlObject.protocol.slice(0, -1);
    const hostname = urlObject.hostname;

    return { protocol, hostname } as const;
  }

  static domainToUrl(domainInfo: { protocol: string; hostname: string }) {
    const { protocol, hostname } = domainInfo;

    return `${protocol}://${hostname}`;
  }

  static domainInfoToUrl(domainInfo: { scheme?: string | null; domain?: string | null }) {
    const { scheme: protocol, domain: hostname } = domainInfo;

    assert(protocol && hostname);

    return Url.domainToUrl({ protocol, hostname });
  }
}
