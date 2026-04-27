import type { Store } from "./types/store";

export class MemoryStore<T = any> implements Store<T> {
  private store: Map<string, T>;
  private lock: Promise<void>;
  private maxItems: number;

  constructor(maxItems: number = 5000) {
    this.store = new Map<string, T>();
    this.lock = Promise.resolve();
    this.maxItems = maxItems;
  }

  public async get(key: string): Promise<T | undefined> {
    await this.lock;
    return this.store.get(key);
  }

  public async set(key: string, value: T): Promise<void> {
    this.lock = this.lock.then(() => {
      if (this.store.size >= this.maxItems && !this.store.has(key)) {
        const firstKey = this.store.keys().next().value;
        if (firstKey !== undefined) this.store.delete(firstKey);
      }
      this.store.set(key, value);
    });
    await this.lock;
  }

  async delete(sessionId: string): Promise<void> {
    await this.lock;
    this.store.delete(sessionId);
  }
}
