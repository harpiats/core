import { MemoryStore } from "./memory-store";
import type { MonitorInterface, Options, TrafficSource, VisitorData } from "./types/monitor";
import type { Store } from "./types/store";

export class RequestMonitor {
  private request: Request | null = null;
  private clientIp: string | null = null;
  private trafficSource: TrafficSource | null = null;
  private store: Store;
  private ignoredPaths: string[];

  constructor(options?: Options) {
    const { store, ignore } = options || {};

    this.store = store || new MemoryStore();
    this.ignoredPaths = ignore || [];
  }

  public async initialize(request: Request, clientIp: string, trafficSource?: TrafficSource): Promise<void> {
    this.request = request;
    this.clientIp = clientIp;
    this.trafficSource = trafficSource || null;
  }

  private ignorePath(path: string, ignoredPath: string): boolean {
    if (!ignoredPath.startsWith("/")) {
      ignoredPath = `/${ignoredPath}`;
    }

    if (path !== ignoredPath) {
      return false;
    }

    return true;
  }

  private getClientIp(): string {
    if (!this.request || !this.clientIp) {
      throw new Error("Monitor has not been initialized with request data");
    }

    const headers = this.request.headers;
    const ipFromSocket = this.clientIp || "unknown";
    const ipFromHeaders =
      headers.get("x-forwarded-for")?.split(",")[0] || headers.get("cf-connecting-ip") || headers.get("x-real-ip");

    return ipFromHeaders || ipFromSocket;
  }

  private mapToObject<K extends string | number | symbol, V>(map: Map<K, V>): Record<K, V> {
    const obj = {} as Record<K, V>;

    for (const [key, value] of map.entries()) {
      if (value instanceof Map) {
        obj[key] = this.mapToObject(value) as any;
      } else {
        obj[key] = value;
      }
    }

    return obj;
  }

  public async saveMetrics(monitor: MonitorInterface): Promise<void> {
    const metrics = {
      access: {
        visitorsByDate: this.mapToObject(monitor.access.visitorsByDate),
        totalRequests: monitor.access.totalRequests,
      },
      behavior: {
        pageViews: this.mapToObject(monitor.behavior.pageViews),
      },
    };

    await this.store.set("metrics", metrics);
  }

  public async getMetrics(): Promise<any> {
    const metrics = await this.store.get("metrics");
    return metrics || { access: { visitorsByDate: {}, totalRequests: 0 }, behavior: { pageViews: {} } };
  }

  private convertStoredMetrics(metricsObj: any): MonitorInterface {
    const visitorsByDate = new Map<string, Map<string, VisitorData>>();

    if (metricsObj.access?.visitorsByDate) {
      for (const date in metricsObj.access.visitorsByDate) {
        const dailyVisitorsObj = metricsObj.access.visitorsByDate[date];
        const dailyVisitorsMap = new Map<string, VisitorData>(Object.entries(dailyVisitorsObj));

        visitorsByDate.set(date, dailyVisitorsMap);
      }
    }

    const pageViews = new Map<string, number>(Object.entries(metricsObj.behavior?.pageViews || {}));

    return {
      access: {
        visitorsByDate,
        totalRequests: metricsObj.access?.totalRequests || 0,
      },
      behavior: {
        pageViews,
      },
    };
  }

  public async handleRequest(): Promise<Response | void> {
    if (!this.request || !this.clientIp) {
      throw new Error("Monitor has not been initialized with request data");
    }

    const clientIp = this.getClientIp();

    try {
      if (clientIp === "unknown") {
        throw new Error("Invalid client IP");
      }

      const url = new URL(this.request.url);
      const path = url.pathname;

      for (const ignoredPath of this.ignoredPaths) {
        if (this.ignorePath(path, ignoredPath)) {
          return new Response(null, { status: 204 }); // No Content
        }
      }

      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // Retrieve saved metrics and convert them to MonitorInterface (with Maps)
      const storedMetrics = await this.getMetrics();
      let monitor: MonitorInterface;

      if (storedMetrics) {
        monitor = this.convertStoredMetrics(storedMetrics);
      } else {
        monitor = {
          access: { visitorsByDate: new Map(), totalRequests: 0 },
          behavior: { pageViews: new Map() },
        };
      }

      if (!monitor.access.visitorsByDate.has(dateKey)) {
        monitor.access.visitorsByDate.set(dateKey, new Map<string, VisitorData>());
      }

      const dailyVisitors = monitor.access.visitorsByDate.get(dateKey)!;

      if (!dailyVisitors.has(clientIp)) {
        dailyVisitors.set(clientIp, {
          totalRequests: 0,
          pagesVisited: [],
          responseTimes: [],
          errors: 0,
        });
      }

      const visitorData = dailyVisitors.get(clientIp)!;

      // Update access metrics
      visitorData.totalRequests++;
      visitorData.pagesVisited.push({
        path,
        timestamp,
        trafficSource: this.trafficSource || undefined,
      });
      monitor.access.totalRequests++;

      // Update behavior metrics
      monitor.behavior.pageViews.set(path, (monitor.behavior.pageViews.get(path) || 0) + 1);

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      visitorData.responseTimes.push(responseTime);

      // Save updated metrics to the store
      await this.saveMetrics(monitor);
    } catch (_error) {
      const dateKey = new Date().toISOString().split("T")[0];

      // Tenta recuperar métricas para atualizar o contador de erros
      const storedMetrics = await this.getMetrics();
      let monitor: MonitorInterface;
      if (storedMetrics) {
        monitor = this.convertStoredMetrics(storedMetrics);
      } else {
        monitor = {
          access: { visitorsByDate: new Map(), totalRequests: 0 },
          behavior: { pageViews: new Map() },
        };
      }

      if (!monitor.access.visitorsByDate.has(dateKey)) {
        monitor.access.visitorsByDate.set(dateKey, new Map<string, VisitorData>());
      }

      const dailyVisitors = monitor.access.visitorsByDate.get(dateKey)!;

      if (!dailyVisitors.has(clientIp)) {
        dailyVisitors.set(clientIp, {
          totalRequests: 0,
          pagesVisited: [],
          responseTimes: [],
          errors: 0,
        });
      }

      dailyVisitors.get(clientIp)!.errors++;

      await this.saveMetrics(monitor);

      return new Response(JSON.stringify({ error: "An error occurred on the server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
