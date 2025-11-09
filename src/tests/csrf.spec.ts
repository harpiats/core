import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { CSRF } from "../csrf";
import { MemoryStore } from "../memory-store";

describe("CSRF", () => {
  let csrf: CSRF;
  let store: MemoryStore;
  const sessionId = "session-123";

  beforeEach(() => {
    store = new MemoryStore();
    csrf = new CSRF({ store, ttl: 1000 }); // 1-second TTL for tests
  });

  it("generates a unique token and stores it", async () => {
    const token = await csrf.generate(sessionId);
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64); // 32 bytes in hex
    const stored = await store.get(sessionId);
    expect(stored?.token).toBe(token);
  });

  it("deletes a previous token before generating a new one", async () => {
    const oldToken = await csrf.generate(sessionId);
    const spy = spyOn(store, "delete");

    const newToken = await csrf.generate(sessionId);

    expect(spy).toHaveBeenCalledWith(sessionId);
    expect(newToken).not.toBe(oldToken);
  });

  it("returns true if the token is valid and within the TTL", async () => {
    const token = await csrf.generate(sessionId);
    const valid = await csrf.check(sessionId, token);
    expect(valid).toBe(true);
  });

  it("returns false if the token is incorrect", async () => {
    await csrf.generate(sessionId);
    const valid = await csrf.check(sessionId, "invalid-token");
    expect(valid).toBe(false);
  });

  it("returns false if the token has expired", async () => {
    const token = await csrf.generate(sessionId);

    // force expiration by simulating time passage
    const stored = await store.get(sessionId);
    if (stored) stored.createdAt = Date.now() - 2000;
    await store.set(sessionId, stored);

    const valid = await csrf.check(sessionId, token);
    expect(valid).toBe(false);
  });

  it("deletes the token properly", async () => {
    await csrf.generate(sessionId);
    await csrf.delete(sessionId);
    const stored = await store.get(sessionId);
    expect(stored).toBeUndefined(); // MemoryStore returns undefined if key doesn’t exist
  });
});
