export type Data = Record<string, any>;
export type Blocks = Record<string, string>;
export type PluginFunction = (...args: any[]) => any;
export type Options = {
  viewName?: string;
  useModules?: boolean;
  fileExtension?: string;
  path: {
    views: string;
    layouts: string;
    partials: string;
  };
};
