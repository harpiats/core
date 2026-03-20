import { Application } from "./src/server";

export { Request } from "./src/request";
export { Response } from "./src/response";
export { TestClient } from "./src/test-client";

export type NextFunction = () => void;
export type { Application as Harpia } from "./src/server";
export type { CorsOptions } from "./src/types/cors";
export type { CookiesOptions } from "./src/types/cookies";
export type { Store } from "./src/types/store";

export default function harpia(): Application {
  return new Application();
}

export { Router } from "./src/router";
