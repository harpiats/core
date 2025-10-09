import { WebSocket } from "./websocket";

import type { Handler } from "./types/handler";
import type { RouteInterface, RouterRegisterTypes } from "./types/router";
import type { WebSocketHandlers, WebSocketInterface } from "./types/websocket";

export class Router {
  private routes: RouteInterface[];
  private prefix: string;
  private websocket: WebSocket;

  constructor(prefix?: string) {
    this.routes = [];
    this.prefix = prefix ? this.formatPrefix(prefix) : "";
    this.websocket = new WebSocket();
  }

  public register({ routes, wsRoutes, prefix }: RouterRegisterTypes): void {
    let routesWithPrefix: RouteInterface[] = routes;

    if (prefix) {
      routesWithPrefix = routes.map((route) => {
        route.path = `${prefix}${route.path}`;
        return route;
      });
    }

    if (wsRoutes) {
      let websocketWithPrefix: WebSocketInterface[] = wsRoutes;

      if (prefix) {
        websocketWithPrefix = wsRoutes.map((route) => {
          route.path = `${prefix}${route.path}`;
          return route;
        });
      }

      this.websocket.register(websocketWithPrefix);
    }

    this.routes.push(...routesWithPrefix);
  }

  public list(): RouteInterface[] {
    return this.routes;
  }

  public wsList(): WebSocketInterface[] {
    return this.websocket.list();
  }

  public getPrefix(): string {
    return this.prefix;
  }

  public get(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "GET", path, handlers, controller });

    return this;
  }

  public post(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "POST", path, handlers, controller });

    return this;
  }

  public put(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "PUT", path, handlers, controller });

    return this;
  }

  public delete(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "DELETE", path, handlers, controller });

    return this;
  }

  public patch(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "PATCH", path, handlers, controller });

    return this;
  }

  public options(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "OPTIONS", path, handlers, controller });

    return this;
  }

  public head(path: string, ...handlers: Handler[]): this {
    const controller = handlers.pop();

    if (!controller) {
      throw new Error("Controller handler is required.");
    }

    this.routes.push({ method: "HEAD", path, handlers, controller });

    return this;
  }

  public ws<DataType = any>(path: string, controller: WebSocketHandlers<DataType>): void {
    this.websocket.ws(path, controller as WebSocketHandlers<unknown>);
  }

  public isRouteMatching(url: string, method: string): RouteInterface | null {
    const urlSegments = url.split("/").filter(Boolean);

    for (const route of this.routes) {
      const routeSegments = route.path.split("/").filter(Boolean);

      if (route.method !== method) {
        continue;
      }

      if (urlSegments.length !== routeSegments.length) {
        continue;
      }

      const isSegmentMatching = routeSegments.every((segment, index) => {
        return segment.startsWith(":") || segment === urlSegments[index];
      });

      if (isSegmentMatching) {
        return route;
      }
    }

    return null;
  }

  private formatPrefix(prefix: string): string {
    return prefix.startsWith("/") ? prefix : `/${prefix}`;
  }
}
