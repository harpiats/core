import type { Application } from "../server";

export type RenderPromise = Promise<string> & {
  minify: (type?: "html" | "generic") => Promise<string>;
};

export interface Engine {
  configure: (app: Application) => void;
  render: (view: string, data: Record<string, any>) => RenderPromise;
}
