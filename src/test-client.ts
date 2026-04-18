import path from "node:path";
import type { FetchResponse } from "./response";
import type { Application } from "./server";

export class TestClient {
  private app: Application;
  private headersInstance: Headers;

  private method: string;
  private baseUrl: string;
  private port: number;
  private url: string;
  private body: any = null;
  private bodyType: "json" | "formData" | null = null;

  constructor(app: Application) {
    this.app = app;
    this.headersInstance = new Headers();

    this.port = this.app.server().port || 3000;
    this.baseUrl = `http://${this.app.server().hostname}:${this.port}`;
    this.method = "";
    this.url = "";
  }

  public get(url: string): TestClient {
    this.method = "GET";
    this.url = url;
    return this;
  }

  public post(url: string): TestClient {
    this.method = "POST";
    this.url = url;
    return this;
  }

  public put(url: string): TestClient {
    this.method = "PUT";
    this.url = url;
    return this;
  }

  public delete(url: string): TestClient {
    this.method = "DELETE";
    this.url = url;
    return this;
  }

  public patch(url: string): TestClient {
    this.method = "PATCH";
    this.url = url;
    return this;
  }

  public options(url: string): TestClient {
    this.method = "OPTIONS";
    this.url = url;
    return this;
  }

  public head(url: string): TestClient {
    this.method = "HEAD";
    this.url = url;
    return this;
  }

  public set(name: string, value: string): TestClient {
    this.headersInstance.set(name, value);
    return this;
  }

  public query(name: string, value: string): TestClient {
    const url = new URL(`${this.baseUrl}${this.url}`);
    url.searchParams.set(name, value);
    this.url = url.toString().replace(this.baseUrl, "");
    return this;
  }

  public send(data: any): this {
    if (this.bodyType) {
      throw new Error("Cannot use send() after json(), formData(), or files().");
    }

    this.body = data;
    this.headersInstance.set("Content-Length", data.length.toString());
    return this;
  }

  public json(data: any): this {
    if (this.bodyType && this.bodyType !== "json") {
      throw new Error("Cannot use json() after formData() or files().");
    }

    this.bodyType = "json";
    this.headersInstance.set("Content-Type", "application/json");
    this.body = typeof data === "string" ? JSON.parse(data) : data;
    return this;
  }

  public formData(data: Record<string, string | Blob>): this {
    if (this.bodyType && this.bodyType !== "formData") {
      throw new Error("Cannot use formData() after json().");
    }

    this.bodyType = "formData";
    const formData = this.body instanceof FormData ? this.body : new FormData();

    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }

    this.body = formData;
    return this;
  }

  public file(files: Record<string, string | Blob>): this {
    if (this.bodyType && this.bodyType !== "formData") {
      throw new Error("Cannot use file() after json().");
    }

    this.bodyType = "formData";
    const formData = this.body instanceof FormData ? this.body : new FormData();

    for (const [key, value] of Object.entries(files)) {
      if (typeof value === "string") {
        const file = Bun.file(value);
        if (!file.size) {
          throw new Error(`File not found at path: ${value}`);
        }

        const blob = new Blob([file], { type: file.type });
        formData.append(key, blob, path.basename(value));
      } else if (value instanceof Blob) {
        formData.append(key, value, (value as any).name || "blob");
      } else {
        throw new Error(`Invalid file type for key "${key}". Expected a file path (string) or Blob.`);
      }
    }

    this.body = formData;
    return this;
  }

  public files(files: Record<string, (string | Blob)[]>): this {
    if (this.bodyType && this.bodyType !== "formData") {
      throw new Error("Cannot use files() after json().");
    }

    this.bodyType = "formData";
    const formData = this.body instanceof FormData ? this.body : new FormData();

    for (const [key, values] of Object.entries(files)) {
      for (const value of values) {
        if (typeof value === "string") {
          const file = Bun.file(value);
          if (!file.size) {
            throw new Error(`File not found at path: ${value}`);
          }

          formData.append(key, file, path.basename(value));
        } else if (value instanceof Blob) {
          formData.append(key, value, (value as any).name || "blob");
        } else {
          throw new Error(`Invalid file type for key "${key}". Expected a file path (string) or Blob.`);
        }
      }
    }

    this.body = formData;
    return this;
  }

  public async execute(): Promise<FetchResponse> {
    process.env.ENV = "test";

    const url = `${this.baseUrl}${this.url}`;
    const request = new Request(url, {
      method: this.method,
      headers: this.headersInstance,
      body: this.bodyType === "json" ? JSON.stringify(this.body) : this.body,
    });

    const response = await this.app.processRequest(request);

    return response;
  }
}
