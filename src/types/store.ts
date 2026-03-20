export interface Store<T = any> {
	get(sessionId: string): Promise<T | undefined>;
	set(sessionId: string, data: T): Promise<void>;
	delete(sessionId: string): Promise<void>;
}
