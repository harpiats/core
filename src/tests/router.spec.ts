import { beforeEach, describe, expect, it } from "bun:test";
import { Router } from "../router";
import type { Handler } from "../types/handler";

describe("Router", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should register a GET route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.get("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a POST route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.post("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("POST");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a PUT route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.put("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("PUT");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a DELETE route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.delete("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("DELETE");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a PATCH route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.patch("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("PATCH");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a OPTIONS route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.options("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("OPTIONS");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a HEAD route", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.head("/users", handler);
    const routes = router.list();
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("HEAD");
    expect(routes[0].path).toBe("/users");
    expect(routes[0].controller).toBe(handler);
  });

  it("should register a WS route", () => {
    const handlers = {
      open: () => {},
      message: () => {},
      close: () => {},
      drain: () => {},
      error: () => {},
    };
    router.ws("/ws", handlers);

    const routes = router.wsList();

    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/ws");
    expect(routes[0].handlers).toBe(handlers);
  });

  it("should throw an error if no controller is provided", () => {
    expect(() => router.get("/users")).toThrow("Controller handler is required.");
    expect(() => router.post("/users")).toThrow("Controller handler is required.");
    expect(() => router.put("/users")).toThrow("Controller handler is required.");
    expect(() => router.delete("/users")).toThrow("Controller handler is required.");
    expect(() => router.patch("/users")).toThrow("Controller handler is required.");
    expect(() => router.options("/users")).toThrow("Controller handler is required.");
    expect(() => router.head("/users")).toThrow("Controller handler is required.");
  });

  it("should match a route with parameters", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.get("/users/:userId/posts/:postId", handler);
    const route = router.isRouteMatching("/users/123/posts/456", "GET");
    expect(route).not.toBeNull();
    expect(route?.route.method).toBe("GET");
    expect(route?.route.path).toBe("/users/:userId/posts/:postId");
    expect(route?.route.controller).toBe(handler);
    expect(route?.params).toEqual({ userId: "123", postId: "456" });
  });

  it("should not match a route with different method", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.get("/users/:userId", handler);
    const route = router.isRouteMatching("/users/123", "POST");
    expect(route).toBeNull();
  });

  it("should not match a route with different number of segments", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.get("/users/:userId/posts/:postId", handler);
    const route = router.isRouteMatching("/users/123/posts", "GET");
    expect(route).toBeNull();
  });

  it("should not match a route with different segments", () => {
    const handler: Handler = (_req, _res, _next) => {};
    router.get("/users/:userId/posts/:postId", handler);
    const route = router.isRouteMatching("/users/123/comments/456", "GET");
    expect(route).toBeNull();
  });

  it("should return null if no route matches", () => {
    const route = router.isRouteMatching("/products", "GET");
    expect(route).toBeNull();
  });

  it("should register multiple handlers", () => {
    const handler1: Handler = (_req, _res, _next) => {};
    const handler2: Handler = (_req, _res, _next) => {};
    const controller: Handler = (_req, _res, _next) => {};

    router.get("/users", handler1, handler2, controller);
    const routes = router.list();

    expect(routes).toHaveLength(1);
    expect(routes[0].handlers).toHaveLength(2);
    expect(routes[0].handlers[0]).toBe(handler1);
    expect(routes[0].handlers[1]).toBe(handler2);
    expect(routes[0].controller).toBe(controller);
  });

  it("should register routes with prefix", () => {
    const handler: Handler = (_req, _res, _next) => {};
    const subRouter = new Router("/api");
    const prefix = subRouter.getPrefix();

    subRouter.get("/users", handler);
    router.register({ prefix, routes: subRouter.list() });

    const routes = router.list();

    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/api/users");
  });

  it("should register routes with prefix and without prefix", () => {
    const handler: Handler = (_req, _res, _next) => {};
    const subRouter = new Router("/api");
    const prefix = subRouter.getPrefix();

    subRouter.get("/users", handler);
    router.register({ prefix, routes: subRouter.list() });
    router.get("/products", handler);

    const routes = router.list();
    expect(routes).toHaveLength(2);
    expect(routes[0].path).toBe("/api/users");
    expect(routes[1].path).toBe("/products");
  });

  it("should format prefix correctly", () => {
    const routerWithSlash = new Router("/api");
    expect(routerWithSlash.getPrefix()).toBe("/api");

    const routerWithoutSlash = new Router("api");
    expect(routerWithoutSlash.getPrefix()).toBe("/api");
  });

  it("should register ws routes without prefix", () => {
    const subRouter = new Router();
    subRouter.ws("/chat", { open: () => {} } as any);

    router.register({ routes: [], wsRoutes: subRouter.wsList() });

    const wsRoutes = router.wsList();
    expect(wsRoutes).toHaveLength(1);
    expect(wsRoutes[0].path).toBe("/chat");
  });

  it("should register ws routes with prefix", () => {
    const subRouter = new Router("/api");
    const prefix = subRouter.getPrefix();
    subRouter.ws("/chat", { open: () => {} } as any);

    router.register({ prefix, routes: [], wsRoutes: subRouter.wsList() });

    const wsRoutes = router.wsList();
    expect(wsRoutes).toHaveLength(1);
    expect(wsRoutes[0].path).toBe("/api/chat");
  });
});
