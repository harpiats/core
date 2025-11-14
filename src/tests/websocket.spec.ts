import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import { WebSocket } from "../websocket";

describe("WebSocket", () => {
  let websocket: WebSocket;
  const mockWs = (url: string): ServerWebSocket<any> =>
    ({
      data: { url },
      readyState: 1,
      send: mock(() => {}),
      close: mock(() => {}),
      subscribe: mock(() => {}),
      unsubscribe: mock(() => {}),
      publish: mock(() => {}),
      isSubscribed: mock(() => true),
    }) as any;

  const defaultHandlers = {
    open: mock(() => {}),
    message: mock(() => {}),
    close: mock(() => {}),
    drain: mock(() => {}),
    error: mock(() => {}),
  } as any;

  beforeEach(() => {
    websocket = new WebSocket();
  });

  describe("Core Functionality", () => {
    test("should initialize with empty state", () => {
      expect(websocket.list()).toEqual([]);
      expect(websocket["connections"].size).toBe(0);
    });

    test("should register routes", () => {
      websocket.ws("/chat", defaultHandlers);
      expect(websocket.list()).toHaveLength(1);
    });

    test("should register multiple routes via register()", () => {
      const routes = [
        { path: "/chat", handlers: defaultHandlers },
        { path: "/notifications", handlers: defaultHandlers },
      ];
      websocket.register(routes);
      expect(websocket.list()).toHaveLength(2);
      expect(websocket.get("/chat")).toBeDefined();
      expect(websocket.get("/notifications")).toBeDefined();
    });
  });

  describe("Route Matching", () => {
    beforeEach(() => {
      websocket.ws("/chat", defaultHandlers);
      websocket.ws("/user/:id", defaultHandlers);
    });

    test("should find exact path", () => {
      expect(websocket.get("/chat")).toBeDefined();
    });

    test("should return undefined for non-existent exact path", () => {
      expect(websocket.get("/non-existent")).toBeUndefined();
    });

    test("should match parameterized routes", () => {
      expect(websocket.isRouteMatching("/user/123")).toMatchObject({ path: "/user/:id" });
    });

    test("should reject invalid paths", () => {
      expect(websocket.isRouteMatching("/invalid")).toBeNull();
    });
  });

  describe("Connection Handling", () => {
    test("should accept valid connections", () => {
      websocket.ws("/chat", defaultHandlers);
      const wsInstance = mockWs("ws://localhost/chat");

      websocket.getHandlers().open(wsInstance);
      expect(defaultHandlers.open).toHaveBeenCalled();
      expect(websocket["connections"].size).toBe(1);
    });

    test("should reject invalid routes", () => {
      const wsInstance = mockWs("ws://localhost/invalid");
      websocket.getHandlers().open(wsInstance);
      expect(wsInstance.close).toHaveBeenCalledWith(1003, "Route not allowed");
    });
  });

  describe("Message Handling", () => {
    test("should process messages", () => {
      websocket.ws("/chat", defaultHandlers);
      const wsInstance = mockWs("ws://localhost/chat");

      websocket.getHandlers().message(wsInstance, "test");
      expect(defaultHandlers.message).toHaveBeenCalled();
    });

    test("should broadcast messages", () => {
      websocket.ws("/chat", defaultHandlers);
      const ws1 = mockWs("ws://localhost/chat");
      const ws2 = mockWs("ws://localhost/chat");

      websocket["connections"].add(ws1);
      websocket["connections"].add(ws2);
      websocket.getHandlers().message(ws1, "hello");

      expect(ws2.send).toHaveBeenCalledWith("hello");
    });

    test("should not broadcast to inactive connections", () => {
      websocket.ws("/chat", defaultHandlers);
      const ws1 = mockWs("ws://localhost/chat");
      const ws2 = { ...mockWs("ws://localhost/chat"), readyState: 3 as const }; // Closed state

      websocket["connections"].add(ws1);
      websocket["connections"].add(ws2);
      websocket.getHandlers().message(ws1, "hello");

      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe("Lifecycle Events", () => {
    test("should handle close events", () => {
      websocket.ws("/chat", defaultHandlers);
      const wsInstance = mockWs("ws://localhost/chat");

      websocket["connections"].add(wsInstance);
      websocket.getHandlers().close(wsInstance, 1000, "Normal");

      expect(defaultHandlers.close).toHaveBeenCalled();
      expect(websocket["connections"].size).toBe(0);
    });

    test("should not throw if close handler is not defined", () => {
      websocket.ws("/chat", defaultHandlers); // No close handler

      const wsInstance = mockWs("ws://localhost/chat");
      websocket["connections"].add(wsInstance);
      expect(websocket["connections"].size).toBe(1); // Ensures the connection has been added before closing

      const action = () => websocket.getHandlers().close(wsInstance, 1000, "Normal");
      expect(action).not.toThrow();
      expect(websocket["connections"].size).toBe(0);
    });

    test("should handle drain events", () => {
      websocket.ws("/chat", defaultHandlers);
      const wsInstance = mockWs("ws://localhost/chat");

      websocket.getHandlers().drain(wsInstance);
      expect(defaultHandlers.drain).toHaveBeenCalled();
    });

    test("should handle errors", () => {
      websocket.ws("/chat", defaultHandlers);
      const wsInstance = mockWs("ws://localhost/chat");
      const testError = new Error("test");

      websocket.getHandlers().error(wsInstance, testError);
      expect(defaultHandlers.error).toHaveBeenCalledWith(wsInstance, testError);
    });
  });

  describe("Type Safety", () => {
    test("should support custom data types", () => {
      interface UserData {
        id: string;
      }
      const typedWs = new WebSocket<UserData>();
      defaultHandlers.open = mock((ws: ServerWebSocket<{ url: string; id: string }>) => {
        ws.data.id = "123"; // Type checked
      });

      typedWs.ws("/user", defaultHandlers);
      const wsInstance = mockWs("ws://localhost/user");
      typedWs.getHandlers().open(wsInstance);

      expect(defaultHandlers.open).toHaveBeenCalled();
    });
  });
});
