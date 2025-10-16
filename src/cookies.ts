import type { CookieScopeOptions, CookiesOptions } from "./types/cookies";

export class Cookies {
  private cookies: Map<string, string>;

  constructor(cookieHeader?: string) {
    this.cookies = new Map();

    if (cookieHeader) {
      this.parse(cookieHeader);
    }
  }

  private parse(cookieHeader: string): void {
    const pairs = cookieHeader.split(";").map((cookie) => cookie.trim());

    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (key && value) {
        this.cookies.set(decodeURIComponent(key), decodeURIComponent(value));
      }
    }
  }

  public get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public set(name: string, value: string, options: CookiesOptions = {}): string {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    const cookieOptions = {
      path: options.path ? `; Path=${options.path}` : "",
      domain: options.domain ? `; Domain=${options.domain}` : "",
      maxAge: typeof options.maxAge === "number" ? `; Max-Age=${options.maxAge}` : "",
      expires: options.expires ? `; Expires=${options.expires.toUTCString()}` : "",
      httpOnly: options.httpOnly ? "; HTTPOnly" : "",
      secure: options.secure ? "; Secure" : "",
      sameSite: options.sameSite ? `; SameSite=${options.sameSite}` : "",
    };

    cookie += Object.values(cookieOptions).filter(Boolean).join("");

    this.cookies.set(name, value);

    return cookie;
  }

  public delete(name: string, options: CookieScopeOptions = {}): string {
    const cookieString = this.set(name, "", { ...options, maxAge: 0, expires: new Date(0) });
    this.cookies.delete(name);

    return cookieString;
  }

  public getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.cookies.entries()) {
      result[key] = value;
    }
    return result;
  }
}
