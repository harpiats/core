import { MemoryStore } from "./memory-store";
import type { Store } from "./types/store";

export class Cache<T = any> {
	private store: Store<T>;

	constructor(options?: { store?: Store<T> }) {
		this.store = options?.store || new MemoryStore<T>();
	}

	async get(key: string): Promise<T | undefined> {
		return this.store.get(key);
	}

	async set(key: string, value: T): Promise<void> {
		await this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		await this.store.delete(key);
	}
}
