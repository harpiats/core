import type { RouteInterface } from "./router";

export interface RadixNode {
  children: Map<string, RadixNode>;
  route?: RouteInterface;
  paramName?: string;
  wildcardNode?: RadixNode;
}
