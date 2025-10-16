import type { Handler } from "./handler";
import type { WebSocketInterface } from "./websocket";

export type MethodOptions = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

export interface RouteInterface {
  method: MethodOptions;
  path: string;
  handlers: Handler[];
  controller: Handler;
}

export type RouterRegisterTypes = {
  routes: RouteInterface[];
  wsRoutes?: WebSocketInterface[];
  prefix?: string;
};
