import type { Handler } from "./types/handler";
import type { MatchedRoute, RouteInterface, RouterRegisterTypes } from "./types/router";
import type { WebSocketHandlers, WebSocketInterface } from "./types/websocket";
import { RadixTree } from "./radix";

export class Router {
  private routes: RouteInterface[];
  private prefix: string;
  private wsRoutes: WebSocketInterface[];
  private treeMapping: Map<string, RadixTree>;

  constructor(prefix?: string) {
    this.routes = [];
    this.prefix = prefix ? this.formatPrefix(prefix) : "";
    this.wsRoutes = [];
    this.treeMapping = new Map();
  }

  private getTree(method: string): RadixTree {
    if (!this.treeMapping.has(method)) {
      this.treeMapping.set(method, new RadixTree());
    }
    return this.treeMapping.get(method)!;
  }

  public register({ routes, wsRoutes, prefix }: RouterRegisterTypes): void {
    let routesWithPrefix: RouteInterface[] = routes;

    if (prefix) {
      routesWithPrefix = routes.map((route) => {
        return { ...route, path: `${prefix}${route.path}` };
      });
    }

    if (wsRoutes) {
      let wsWithPrefix = wsRoutes;

      if (prefix) {
        wsWithPrefix = wsRoutes.map((route) => {
          return { ...route, path: `${prefix}${route.path}` };
        });
      }

      this.wsRoutes.push(...wsWithPrefix);
    }

    for (const route of routesWithPrefix) {
      this.routes.push(route);
      this.getTree(route.method).insert(route);
    }
  }

  public list(): RouteInterface[] {
    return this.routes;
  }

  public wsList(): WebSocketInterface[] {
    return this.wsRoutes;
  }

  public getPrefix(): string {
    return this.prefix;
  }

  private addRoute(method: string, path: string, handlers: Handler[], controller: Handler) {
    const route: RouteInterface = { method: method as any, path, handlers, controller };
    this.routes.push(route);
    this.getTree(method).insert(route);
  }

  public get(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("GET", path, handlers, controller);
    return this;
  }

  public post(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("POST", path, handlers, controller);
    return this;
  }

  public put(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("PUT", path, handlers, controller);
    return this;
  }

  public delete(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("DELETE", path, handlers, controller);
    return this;
  }

  public patch(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("PATCH", path, handlers, controller);
    return this;
  }

  public options(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("OPTIONS", path, handlers, controller);
    return this;
  }

  public head(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();
    if (!controller) {
      throw new Error("Controller handler is required.");
    }
    this.addRoute("HEAD", path, handlers, controller);
    return this;
  }

  public ws<DataType = any>(path: string, handlers: WebSocketHandlers<DataType>) {
    this.wsRoutes.push({ path, handlers });
  }

  public isRouteMatching(url: string, method: string): MatchedRoute | null {
    if (!this.treeMapping.has(method)) {
      return null;
    }

    const tree = this.treeMapping.get(method)!;
    const result = tree.search(url);

    if (result.route) {
      return { route: result.route, params: result.params };
    }

    return null;
  }

  private formatPrefix(prefix: string): string {
    return prefix.startsWith("/") ? prefix : `/${prefix}`;
  }
}
