import type { ServerWebSocket } from "bun";
import type { WebSocketOptions } from "./types/server";
import type { InternalWebSocketData, WebSocketHandlers, WebSocketInterface } from "./types/websocket";

export class WebSocket<T = any> {
  private routes: WebSocketInterface<T>[];
  private connections: Set<ServerWebSocket<InternalWebSocketData<T>>>;

  constructor() {
    this.routes = [];
    this.connections = new Set();
  }

  public ws(path: string, handlers: WebSocketHandlers<T>): void {
    this.routes.push({ path, handlers });
  }

  public register(websockets: WebSocketInterface[]) {
    for (const route of websockets) {
      this.ws(route.path, route.handlers);
    }
  }

  public list(): WebSocketInterface[] {
    return this.routes;
  }

  public get(path: string): WebSocketInterface | undefined {
    return this.routes.find((route) => route.path === path);
  }

  public isRouteMatching(url: string): WebSocketInterface | null {
    const urlSegments = url.split("/").filter(Boolean);

    for (const route of this.routes) {
      const routeSegments = route.path.split("/").filter(Boolean);

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

  public getHandlers(): WebSocketOptions<InternalWebSocketData<T>> {
    return {
      message: (ws, message) => {
        const pathname = new URL(ws.data.url).pathname;
        const route = this.isRouteMatching(pathname);

        if (route?.handlers.message) {
          route.handlers.message(ws, message);

          for (const connection of this.connections) {
            if (connection !== ws && connection.readyState === 1) {
              connection.send(`${message}`);
            }
          }
        }
      },
      open: (ws) => {
        const pathname = new URL(ws.data.url).pathname;
        const route = this.isRouteMatching(pathname);

        if (route?.handlers.open) {
          this.connections.add(ws);
          route.handlers.open(ws);
        } else {
          ws.close(1003, "Route not allowed");
        }
      },
      close: (ws, code, message) => {
        const pathname = new URL(ws.data.url).pathname;
        const route = this.isRouteMatching(pathname);

        if (route?.handlers.close) {
          this.connections.delete(ws);
          route.handlers.close(ws, code, message);
        }
      },
      drain: (ws) => {
        const pathname = new URL(ws.data.url).pathname;
        const route = this.isRouteMatching(pathname);

        if (route?.handlers.drain) {
          route.handlers.drain(ws);
        }
      },
      error: (ws, error) => {
        const pathname = new URL(ws.data.url).pathname;
        const route = this.isRouteMatching(pathname);

        if (route?.handlers.error) {
          route.handlers.error(ws, error);
        }
      },
    };
  }
}
