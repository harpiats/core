import type { BunFile, ServerWebSocket } from "bun";

export type ServerOptions = {
  port?: number;
  development?: boolean;
  hostname?: string;
  tls?: TLSOptions;
  unix?: string;
  reusePort?: boolean;
  maxRequestBodySize?: number;
  // ws?: Partial<WebSocketOptions<WebSocketData>>;
};

export type TLSOptions = {
  key?: BunFile;
  cert?: BunFile;
  ca?: BunFile;
  passphrase?: string;
  serverName?: string;
  dhParamsFile?: string;
  lowMemoryMode?: boolean;
};

export type WebSocketData = {
  url: string;
  data: Record<string, any>;
};

export type WebSocketOptions<DataType = unknown> = {
  message: (ws: ServerWebSocket<DataType>, message: string | Buffer) => void | Promise<void>;
  open: (ws: ServerWebSocket<DataType>) => void | Promise<void>;
  close: (ws: ServerWebSocket<DataType>, code: number, reason: string) => void | Promise<void>;
  drain: (ws: ServerWebSocket<DataType>) => void | Promise<void>;
  error: (ws: ServerWebSocket<DataType>, error: Error) => void | Promise<void>;
  maxPayloadLength?: number;
  idleTimeout?: number;
  backpressureLimit?: number;
  closeOnBackpressureLimit?: boolean;
  sendPings?: boolean;
  publishToSelf?: boolean;
  perMessageDeflate?: {
    compress?: boolean;
    decompress?: boolean;
  };
};
