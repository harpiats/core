import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Cookies } from "../cookies";
import { MemoryStore } from "../memory-store";
import { Request } from "../request";
import { Response } from "../response";
import { Session } from "../session";

import type { Store } from "../types/store";

// Mock crypto.randomUUID for testing
const mockUUID = "mock-uuid-mock-uuid-mock-uuid-mock";
spyOn(global.crypto, "randomUUID").mockReturnValue(mockUUID);

describe("Session", () => {
  let session: Session;
  let store: Store;

  beforeEach(() => {
    store = new MemoryStore();
    session = new Session({ store });
  });

  it("should create a session with default values", () => {
    const defaultSession = new Session();
    expect((defaultSession as any).store).toBeInstanceOf(MemoryStore);
    expect((defaultSession as any).cookieName).toBe("session_id");
    expect((defaultSession as any).cookies).toBeInstanceOf(Cookies);
  });

  it("should create a session with custom values", () => {
    const customStore = new MemoryStore();
    const customSession = new Session({ store: customStore, cookieName: "custom_session" });
    expect((customSession as any).store).toBe(customStore);
    expect((customSession as any).cookieName).toBe("custom_session");
    expect((customSession as any).cookies).toBeInstanceOf(Cookies);
  });

  it("should generate a session ID", () => {
    const sessionId = (session as any).generateSessionId();
    expect(sessionId).toBe(mockUUID);
  });

  it("should create a session and store data", async () => {
    const data = { user: "testuser" };
    const sessionId = await session.create(data);
    expect(sessionId).toBe(mockUUID);
    const storedData = await store.get(sessionId);
    expect(storedData).toEqual(data);
  });

  it("should get session data by session ID", async () => {
    const data = { user: "testuser" };
    const sessionId = await session.create(data);
    const retrievedData = await session.get(sessionId);
    expect(retrievedData).toEqual(data);
  });

  it("should return undefined if session ID does not exist", async () => {
    const retrievedData = await session.get("nonexistent-session-id");
    expect(retrievedData).toBeUndefined();
  });

  it("should update session data", async () => {
    const initialData = { user: "testuser", role: "user" };
    const sessionId = await session.create(initialData);
    const updatedData = { role: "admin", permissions: ["read", "write"] };
    const result = await session.update(sessionId, updatedData);
    expect(result).toBe(true);
    const retrievedData = await session.get(sessionId);
    expect(retrievedData).toEqual({ ...initialData, ...updatedData });
  });

  it("should return false if trying to update a non-existent session", async () => {
    const updatedData = { role: "admin" };
    const result = await session.update("nonexistent-session-id", updatedData);
    expect(result).toBe(false);
  });

  it("should delete a session and set a delete cookie", async () => {
    const data = { user: "testuser" };
    const sessionId = await session.create(data);
    const res = new Response();
    const deleteSpy = spyOn((session as any).cookies, "delete");
    await session.delete(sessionId, res);
    expect(deleteSpy).toHaveBeenCalledWith("session_id");
    expect(res.headers.get("Set-Cookie")).toBeDefined();
    const retrievedData = await session.get(sessionId);
    expect(retrievedData).toBeUndefined();
  });

  it("should get session data from a request", async () => {
    const reqInit: RequestInit = {
      headers: new Headers(),
    };

    const res = new Response();
    const userData = { username: "john_doe", role: "admin" };
    const sessionId = await session.create(userData);

    session.setCookie(res, sessionId);

    const setCookieHeader = res.headers.get("Set-Cookie")!;

    (reqInit.headers as Headers).set("Cookie", setCookieHeader);

    const req = new Request("http://localhost", reqInit, "http://localhost", "/", "GET");
    const userSession = await session.fromRequest(req);

    expect(userSession).toEqual(userData);
  });

  it("should return undefined if no session ID in request", async () => {
    const req = new Request("http://localhost", {}, "http://localhost", "/", "GET");
    const retrievedData = await session.fromRequest(req);
    expect(retrievedData).toBeUndefined();
  });

  it("should get session data from a WebSocket connection", async () => {
    const userData = { user: "ws_user" };
    const sessionId = await session.create(userData);

    const mockWs: any = {
      data: {
        cookies: {
          session_id: sessionId,
          other_cookie: "some_value",
        },
      },
    };

    const retrievedData = await session.fromWebSocket(mockWs);
    expect(retrievedData).toEqual(userData);
  });

  it("should return undefined if no session cookie in WebSocket connection", async () => {
    const mockWs: any = {
      data: {
        cookies: { other_cookie: "some_value" },
      },
    };

    const retrievedData = await session.fromWebSocket(mockWs);
    expect(retrievedData).toBeUndefined();
  });

  it("should set a cookie with default options", () => {
    const res = new Response();
    const setSpy = spyOn((session as any).cookies, "set");
    session.setCookie(res, "test-session-id");
    expect(setSpy).toHaveBeenCalledWith("session_id", "test-session-id", {});
    expect(res.headers.get("Set-Cookie")).toBeDefined();
  });

  it("should set a cookie with custom options", () => {
    const res = new Response();
    const setSpy = spyOn((session as any).cookies, "set");
    const options = { path: "/test", httpOnly: true };
    session.setCookie(res, "test-session-id", options);
    expect(setSpy).toHaveBeenCalledWith("session_id", "test-session-id", options);
    expect(res.headers.get("Set-Cookie")).toBeDefined();
  });
});
