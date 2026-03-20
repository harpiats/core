import type { RadixNode } from "./types/radix";
import type { RouteInterface } from "./types/router";

export function createNode(): RadixNode {
  return {
    children: new Map(),
  };
}

export class RadixTree {
  private root: RadixNode;

  constructor() {
    this.root = createNode();
  }

  public insert(route: RouteInterface): void {
    const segments = route.path.split("/").filter(Boolean);
    let currentNode = this.root;

    for (const segment of segments) {
      if (segment.startsWith(":")) {
        const paramName = segment.slice(1);
        if (!currentNode.wildcardNode) {
          currentNode.wildcardNode = createNode();
        }
        currentNode.wildcardNode.paramName = paramName;
        currentNode = currentNode.wildcardNode;
      } else {
        if (!currentNode.children.has(segment)) {
          currentNode.children.set(segment, createNode());
        }
        currentNode = currentNode.children.get(segment)!;
      }
    }

    currentNode.route = route;
  }

  public search(path: string): { route: RouteInterface | null; params: Record<string, string> } {
    const segments = path.split("/").filter(Boolean);
    let params: Record<string, string> = {};

    const findMatch = (node: RadixNode, index: number): RouteInterface | null => {
      // If we reached the end of the segments
      if (index === segments.length) {
        return node.route || null;
      }

      const segment = segments[index];

      // Exact match (Static route) takes priority
      if (node.children.has(segment)) {
        const childNode = node.children.get(segment)!;
        const result = findMatch(childNode, index + 1);
        if (result) return result; // Return immediately if static route matches
      }

      // Fallback to wildcard (Dynamic route)
      if (node.wildcardNode) {
        const result = findMatch(node.wildcardNode, index + 1);
        if (result) {
          if (node.wildcardNode.paramName) {
            params[node.wildcardNode.paramName] = segment;
          }
          return result;
        }
      }

      return null;
    };

    const route = findMatch(this.root, 0);
    return { route, params: route ? params : {} };
  }
}
