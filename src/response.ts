import { Cookies } from "./cookies";
import { Application } from "./server";
import type { CookiesOptions } from "./types/cookies";

class ResponseWrapper {
  private headersInstance: Headers;
  private statusCode: number;
  private body: any;
  private cookiesInstance: Cookies;
  private currentModule: string | null = null;

  public headers: Headers;
  public cookies = {
    set: this.setCookie.bind(this),
    delete: this.deleteCookie.bind(this),
  };

  constructor() {
    this.headersInstance = new Headers();
    this.statusCode = 200;
    this.body = null;
    this.headers = this.getHeadersInstance();

    this.cookiesInstance = new Cookies();
  }

  public parse(): Response {
    this.setCookiesInHeaders();

    return new Response(this.body, {
      headers: this.headersInstance,
      status: this.statusCode,
    });
  }

  private getHeadersInstance(): Headers {
    return this.headersInstance;
  }

  public status(value: number): this {
    this.statusCode = value;

    return this;
  }

  public send(data: any): this {
    this.body = data;
    this.headersInstance.set("Content-Lenght", data.length.toString());

    return this;
  }

  public html(data: string): this {
    this.body = data;
    this.headersInstance.set("Content-Type", "text/html");

    return this;
  }

  public json(data: any): this {
    this.headersInstance.set("Content-Type", "application/json");
    this.body = JSON.stringify(data);
    return this;
  }

  public redirect(url: string, statusCode = 302): this {
    this.statusCode = statusCode;
    this.headersInstance.set("Location", url);
    this.body = `Redirecting to ${url}`;
    return this;
  }

  public module(moduleName: string): this {
    this.currentModule = moduleName;
    return this;
  }

  public async render(view: string, data: Record<string, any> = {}): Promise<this> {
    const engine = Application.getInstance().engine.get();

    if (!engine) {
      throw new Error("No template engine configured.");
    }

    let resolvedView = view;
    if (this.currentModule && !resolvedView.startsWith("*")) {
      resolvedView = `*${this.currentModule}*/${resolvedView}`;
    }

    try {
      const rendered = await engine.render(resolvedView, data);

      this.headersInstance.set("Content-Type", "text/html");
      this.body = rendered;
    } catch (error) {
      throw new Error((error as Error).message);
    }

    return this;
  }

  private setCookie(name: string, value: string, options?: CookiesOptions): this {
    const cookie = this.cookiesInstance.set(name, value, options);
    this.headersInstance.append("Set-Cookie", cookie);

    return this;
  }

  private deleteCookie(name: string, options?: CookiesOptions): this {
    this.cookiesInstance.delete(name, options);

    return this;
  }

  private setCookiesInHeaders(): void {
    const allCookies = this.cookiesInstance.getAll();

    for (const [name, value] of Object.entries(allCookies)) {
      const cookie = this.cookiesInstance.set(name, value);

      if (!this.headersInstance.get("Set-Cookie")?.includes(cookie)) {
        this.headersInstance.append("Set-Cookie", cookie);
      }
    }
  }
}

export type FetchResponse = Response;
export { ResponseWrapper as Response };
