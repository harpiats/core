import type { BunFile } from "bun";

export type ServerOptions = {
  port?: number;
  development?: boolean;
  hostname?: string;
  tls?: TLSOptions;
  unix?: string;
  reusePort?: boolean;
  maxRequestBodySize?: number;
  ws?: {
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
