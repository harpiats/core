import { MemoryStore } from "./memory-store";
import type { Store } from "./types/store";

export class CSRF {
  private store: Store;
  private ttl: number;

  public constructor(options?: { store?: Store; ttl?: number }) {
    this.store = options?.store || new MemoryStore();
    this.ttl = options?.ttl || 5 * 60 * 1000; // 5 minutes
  }

  public async generate(sessionId: string): Promise<string> {
    await this.store.delete(sessionId);

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Buffer.from(bytes).toString("hex");

    await this.store.set(sessionId, { token, createdAt: Date.now() });

    return token;
  }

  public async check(sessionId: string, token: string): Promise<boolean> {
    const data = await this.store.get(sessionId);
    if (!data) return false;
    if (data.token === token && Date.now() - data.createdAt < this.ttl) return true;
    return false;
  }

  public async delete(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }
}
