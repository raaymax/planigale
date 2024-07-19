import { Cookie, deleteCookie, getCookies, setCookie } from './deps.ts';

export type SetCookieOptions = Omit<Cookie, 'name' | 'value'>;

export class Cookies {
  constructor(private headers: Headers) {}
  get(name: string): string | undefined {
    return getCookies(this.headers)?.[name];
  }
  set(name: string, value: string, options: SetCookieOptions = {}): void {
    setCookie(this.headers, { name, value, ...options });
  }
  delete(name: string): void {
    deleteCookie(this.headers, name);
  }
}
