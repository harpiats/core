import type { ServerWebSocket } from "bun";

export type WebSocketData<T = {}> = T;
export type InternalWebSocketData<T> = { url: string } & WebSocketData<T>;

export type WebSocketHandlers<T = {}> = {
  open?: (ws: ServerWebSocket<InternalWebSocketData<T>>) => void | Promise<void>;
  message?: (ws: ServerWebSocket<InternalWebSocketData<T>>, message: string | Buffer) => void | Promise<void>;
  close?: (ws: ServerWebSocket<InternalWebSocketData<T>>, code: number, reason: string) => void | Promise<void>;
  drain?: (ws: ServerWebSocket<InternalWebSocketData<T>>) => void | Promise<void>;
  error?: (ws: ServerWebSocket<InternalWebSocketData<T>>, error: Error) => void | Promise<void>;
};

export interface WebSocketInterface<T = any> {
  path: string;
  // middlewares: Handler[];
  handlers: WebSocketHandlers<T>;
}
