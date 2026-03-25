import { Application } from "./src/server";

export { Request } from "./src/request";
export { Response } from "./src/response";
export { Router } from "./src/router";
export { TestClient } from "./src/test-client";
export { Cache } from "./src/cache";
export { Session } from "./src/session";
export { Upload } from "./src/upload";
export { Shield } from "./src/shield";
export { RequestMonitor } from "./src/monitor";
export { MemoryStore } from "./src/memory-store";
export { TemplateEngine } from "./src/template-engine";
export { CSRF } from "./src/csrf";

export type NextFunction = () => void;
export type { Application as Harpia } from "./src/server";
export type { CorsOptions } from "./src/types/cors";
export type { CookiesOptions } from "./src/types/cookies";
export type { Store } from "./src/types/store";
export type { SecurityHeaders } from "./src/shield";

export default function harpia(): Application {
  return new Application();
}
