import { describe, expect, it } from "bun:test";
import { RadixTree, createNode } from "../radix";
import type { RouteInterface } from "../types/router";

describe("RadixTree", () => {
  it("should create a new node", () => {
    const node = createNode();
    expect(node.children).toBeInstanceOf(Map);
    expect(node.children.size).toBe(0);
    expect(node.wildcardNode).toBeUndefined();
    expect(node.paramName).toBeUndefined();
    expect(node.route).toBeUndefined();
  });

  it("should insert and search a static route", () => {
    const tree = new RadixTree();
    const route: RouteInterface = { path: "/api/users", method: "GET", handlers: [], controller: () => {} };
    tree.insert(route);

    const result = tree.search("/api/users");
    expect(result.route).toBe(route);
    expect(result.params).toEqual({});
  });

  it("should insert and search a dynamic route", () => {
    const tree = new RadixTree();
    const route: RouteInterface = { path: "/api/users/:id", method: "GET", handlers: [], controller: () => {} };
    tree.insert(route);

    const result = tree.search("/api/users/123");
    expect(result.route).toBe(route);
    expect(result.params).toEqual({ id: "123" });
  });

  it("should return null for unmatched route", () => {
    const tree = new RadixTree();
    const route: RouteInterface = { path: "/api/users", method: "GET", handlers: [], controller: () => {} };
    tree.insert(route);

    const result = tree.search("/api/posts");
    expect(result.route).toBeNull();
  });

  it("should prioritize static routes over dynamic routes", () => {
    const tree = new RadixTree();
    const staticRoute: RouteInterface = { path: "/api/users/new", method: "GET", handlers: [], controller: () => {} };
    const dynamicRoute: RouteInterface = { path: "/api/users/:id", method: "GET", handlers: [], controller: () => {} };
    
    // Inserting dynamic first to make sure search order doesn't depend on insertion order
    tree.insert(dynamicRoute);
    tree.insert(staticRoute);

    const staticResult = tree.search("/api/users/new");
    expect(staticResult.route).toBe(staticRoute);
    expect(staticResult.params).toEqual({});

    const dynamicResult = tree.search("/api/users/123");
    expect(dynamicResult.route).toBe(dynamicRoute);
    expect(dynamicResult.params).toEqual({ id: "123" });
  });

  it("should handle nested dynamic routes", () => {
    const tree = new RadixTree();
    const route: RouteInterface = { path: "/api/users/:userId/posts/:postId", method: "GET", handlers: [], controller: () => {} };
    tree.insert(route);

    const result = tree.search("/api/users/1/posts/42");
    expect(result.route).toBe(route);
    expect(result.params).toEqual({ userId: "1", postId: "42" });
  });
  
  it("should handle root route properly", () => {
    const tree = new RadixTree();
    const route: RouteInterface = { path: "/", method: "GET", handlers: [], controller: () => {} };
    tree.insert(route);

    const result = tree.search("/");
    expect(result.route).toBe(route);
    expect(result.params).toEqual({});
  });
});
