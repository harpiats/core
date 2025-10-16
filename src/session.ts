import { Cookies } from "./cookies";
import { MemoryStore } from "./memory-store";

import type { ServerWebSocket } from "bun";
import type { Request } from "./request";
import type { Response } from "./response";
import type { CookiesOptions } from "./types/cookies";
import type { Store } from "./types/store";

export class Session {
  private store: Store;
  private cookieName: string;
  private cookies: Cookies;

  constructor(options?: { store?: Store; cookieName?: string }) {
    this.store = options?.store || new MemoryStore();
    this.cookieName = options?.cookieName || "session_id";
    this.cookies = new Cookies();
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  public async create(data: Record<string, any>): Promise<string> {
    const sessionId = this.generateSessionId();
    await this.store.set(sessionId, data);
    return sessionId;
  }

  public async get(sessionId: string): Promise<Record<string, any> | undefined> {
    return this.store.get(sessionId);
  }

  public async update(sessionId: string, data: Record<string, any>): Promise<boolean> {
    const existingData = await this.get(sessionId);
    if (existingData) {
      await this.store.set(sessionId, { ...existingData, ...data });
      return true;
    }
    return false;
  }

  public async delete(sessionId: string, res: Response): Promise<void> {
    const cookie = this.cookies.delete(this.cookieName);
    await this.store.delete(sessionId);
    res.headers.append("Set-Cookie", cookie);
  }

  public async fromRequest(req: Request): Promise<Record<string, any> | undefined> {
    const sessionId = req.cookies.get(this.cookieName);
    if (sessionId) {
      return this.get(sessionId);
    }
    return undefined;
  }

  public async fromWebSocket(
    ws: ServerWebSocket<{ cookies?: Record<string, string> } & Record<string, any>>,
  ): Promise<Record<string, any> | undefined> {
    const sessionId = ws.data.cookies?.[this.cookieName];
    if (sessionId) {
      return this.get(sessionId);
    }
    return undefined;
  }

  public setCookie(res: Response, sessionId: string, options: CookiesOptions = {}): void {
    const cookie = this.cookies.set(this.cookieName, sessionId, options);
    res.headers.append("Set-Cookie", cookie);
  }
}
