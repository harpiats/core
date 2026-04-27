import { MemoryStore } from "./memory-store";
import type {
  TelemetryData,
  TelemetrySummary,
  PageData,
  Options,
  TrafficSource,
  VisitorData,
  VisitData,
  DailyStats,
  SecurityParams,
  QueryParams,
  SummaryParams,
  VisitorByIpParams,
  PageByPathParams,
  SlowRequestsParams,
  TopPagesParams,
  TrafficSourcesParams,
  DeleteParams,
} from "./types/telemetry";
import type { Store } from "./types/store";

export class Telemetry {
  private request: Request | null = null;
  private clientIp: string | null = null;
  private trafficSource: TrafficSource | null = null;
  private store: Store<any>;
  private ignoredPaths: string[];
  private trustProxy: boolean;
  private maxVisitorsKeys: number;
  private accessToken: string | null;
  private allowedIps: string[] | null;

  constructor(options?: Options) {
    const { store, ignore, trustProxy, maxVisitorsKeys, accessToken, allowedIps } = options || {};

    this.store = store || new MemoryStore<any>();
    this.ignoredPaths = ignore || [];
    this.trustProxy = trustProxy ?? false;
    this.maxVisitorsKeys = maxVisitorsKeys ?? 5000;
    this.accessToken = accessToken || null;
    this.allowedIps = allowedIps || null;
  }

  private validateAccess(token?: string, callerIp?: string): void {
    if (this.accessToken && token !== this.accessToken) {
      throw new Error("Unauthorized: invalid access token");
    }

    if (this.allowedIps && (!callerIp || !this.allowedIps.includes(callerIp))) {
      throw new Error("Unauthorized: IP not allowed");
    }
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
      throw new Error("Telemetry has not been initialized with request data");
    }

    const ipFromSocket = this.clientIp || "unknown";

    if (this.trustProxy) {
      const headers = this.request.headers;
      const ipFromHeaders =
        headers.get("x-forwarded-for")?.split(",")[0] || headers.get("cf-connecting-ip") || headers.get("x-real-ip");

      return ipFromHeaders || ipFromSocket;
    }

    return ipFromSocket;
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

  public async saveMetrics(telemetryData: TelemetryData): Promise<void> {
    const metrics = {
      access: {
        visitorsByDate: this.mapToObject(telemetryData.access.visitorsByDate),
        totalRequests: telemetryData.access.totalRequests,
      },
      behavior: {
        pageViews: this.mapToObject(telemetryData.behavior.pageViews),
      },
    };

    await this.store.set("metrics", metrics);
  }

  public async getAll(params: SecurityParams = {}): Promise<any> {
    this.validateAccess(params.token, params.callerIp);

    const metrics = await this.store.get("metrics");
    return metrics || { access: { visitorsByDate: {}, totalRequests: 0 }, behavior: { pageViews: {} } };
  }

  public async getMetrics(): Promise<any> {
    const metrics = await this.store.get("metrics");
    return metrics || { access: { visitorsByDate: {}, totalRequests: 0 }, behavior: { pageViews: {} } };
  }

  private convertStoredMetrics(metricsObj: any): TelemetryData {
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

  private getTodayKey(): string {
    return new Date().toISOString().split("T")[0];
  }

  private async loadTelemetryData(): Promise<TelemetryData> {
    const storedMetrics = await this.getMetrics();

    if (storedMetrics) {
      return this.convertStoredMetrics(storedMetrics);
    }

    return {
      access: { visitorsByDate: new Map(), totalRequests: 0 },
      behavior: { pageViews: new Map() },
    };
  }

  // --- Query Methods ---

  public async summary(params: SummaryParams = {}): Promise<TelemetrySummary> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) {
      return { date: dateKey, totalRequests: 0, uniqueVisitors: 0, topPages: [], avgResponseTime: 0, totalErrors: 0 };
    }

    let totalRequests = 0;
    let totalErrors = 0;
    const allResponseTimes: number[] = [];
    const pageViewsMap = new Map<string, number>();

    for (const [, visitor] of dailyVisitors) {
      totalRequests += visitor.totalRequests;

      for (const visit of visitor.visits) {
        if (visit.error) totalErrors++;
        allResponseTimes.push(visit.responseTime);
        pageViewsMap.set(visit.path, (pageViewsMap.get(visit.path) || 0) + 1);
      }
    }

    const topPages = [...pageViewsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, params.limit || 10)
      .map(([path, views]) => ({ path, views }));

    const avgResponseTime =
      allResponseTimes.length > 0 ? allResponseTimes.reduce((sum, t) => sum + t, 0) / allResponseTimes.length : 0;

    return {
      date: dateKey,
      totalRequests,
      uniqueVisitors: dailyVisitors.size,
      topPages,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      totalErrors,
    };
  }

  public async getDailyStats(params: SecurityParams = {}): Promise<DailyStats[]> {
    this.validateAccess(params.token, params.callerIp);

    const data = await this.loadTelemetryData();
    const dates = [...data.access.visitorsByDate.keys()].sort();

    return dates.map((date) => {
      const dailyVisitors = data.access.visitorsByDate.get(date)!;
      let totalRequests = 0;

      for (const [, visitor] of dailyVisitors) {
        totalRequests += visitor.totalRequests;
      }

      return {
        date,
        totalRequests,
        uniqueVisitors: dailyVisitors.size,
      };
    });
  }

  public async getVisitors(params: QueryParams = {}): Promise<Record<string, VisitorData>> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return {};

    return this.mapToObject(dailyVisitors);
  }

  public async getVisitorByIp(params: VisitorByIpParams): Promise<VisitorData | null> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return null;

    return dailyVisitors.get(params.ip) || null;
  }

  public async countUniqueVisitors(params: QueryParams = {}): Promise<number> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    return dailyVisitors?.size || 0;
  }

  public async getPageViews(params: QueryParams = {}): Promise<Record<string, number>> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return {};

    const pageViewsMap = new Map<string, number>();

    for (const [, visitor] of dailyVisitors) {
      for (const visit of visitor.visits) {
        pageViewsMap.set(visit.path, (pageViewsMap.get(visit.path) || 0) + 1);
      }
    }

    return this.mapToObject(pageViewsMap);
  }

  public async getTopPages(params: TopPagesParams): Promise<{ path: string; views: number }[]> {
    this.validateAccess(params.token, params.callerIp);

    const pageViews = await this.getPageViews({ date: params.date, token: params.token, callerIp: params.callerIp });

    return Object.entries(pageViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, params.limit)
      .map(([path, views]) => ({ path, views }));
  }

  public async getPageByPath(params: PageByPathParams): Promise<PageData | null> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return null;

    let views = 0;
    let errorCount = 0;
    const responseTimes: number[] = [];
    const visitors: string[] = [];

    for (const [ip, visitor] of dailyVisitors) {
      const matchingVisits = visitor.visits.filter((v) => v.path === params.path);

      if (matchingVisits.length > 0) {
        views += matchingVisits.length;
        visitors.push(ip);

        for (const visit of matchingVisits) {
          responseTimes.push(visit.responseTime);
          if (visit.error) errorCount++;
        }
      }
    }

    if (views === 0) return null;

    const avgResponseTime =
      responseTimes.length > 0 ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0;

    return {
      path: params.path,
      views,
      visitors,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      errorCount,
    };
  }

  public async getAvgResponseTime(params: QueryParams = {}): Promise<number> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return 0;

    const allTimes: number[] = [];

    for (const [, visitor] of dailyVisitors) {
      for (const visit of visitor.visits) {
        allTimes.push(visit.responseTime);
      }
    }

    if (allTimes.length === 0) return 0;

    return Math.round((allTimes.reduce((sum, t) => sum + t, 0) / allTimes.length) * 100) / 100;
  }

  public async getSlowRequests(
    params: SlowRequestsParams,
  ): Promise<{ ip: string; path: string; timestamp: string; responseTime: number }[]> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return [];

    const slowRequests: { ip: string; path: string; timestamp: string; responseTime: number }[] = [];

    for (const [ip, visitor] of dailyVisitors) {
      for (const visit of visitor.visits) {
        if (visit.responseTime > params.threshold) {
          slowRequests.push({ ip, path: visit.path, timestamp: visit.timestamp, responseTime: visit.responseTime });
        }
      }
    }

    return slowRequests.sort((a, b) => b.responseTime - a.responseTime);
  }

  public async getErrors(
    params: QueryParams = {},
  ): Promise<{ ip: string; path: string; timestamp: string; responseTime: number; error: any }[]> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return [];

    const result: { ip: string; path: string; timestamp: string; responseTime: number; error: any }[] = [];

    for (const [ip, visitor] of dailyVisitors) {
      for (const visit of visitor.visits) {
        if (visit.error) {
          result.push({
            ip,
            path: visit.path,
            timestamp: visit.timestamp,
            responseTime: visit.responseTime,
            error: visit.error,
          });
        }
      }
    }

    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async countErrors(params: QueryParams = {}): Promise<number> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return 0;

    let total = 0;

    for (const [, visitor] of dailyVisitors) {
      for (const visit of visitor.visits) {
        if (visit.error) total++;
      }
    }

    return total;
  }

  public async getTrafficSources(params: TrafficSourcesParams = {}): Promise<Record<string, number>> {
    this.validateAccess(params.token, params.callerIp);

    const dateKey = params.date || this.getTodayKey();
    const data = await this.loadTelemetryData();
    const dailyVisitors = data.access.visitorsByDate.get(dateKey);

    if (!dailyVisitors) return {};

    const sources: Record<string, number> = {};

    for (const [, visitor] of dailyVisitors) {
      for (const visit of visitor.visits) {
        if (visit.trafficSource?.utm?.source) {
          if (params.source && visit.trafficSource.utm.source !== params.source) continue;

          const key = `${visit.trafficSource.utm.source}/${visit.trafficSource.utm.medium || "none"}`;
          sources[key] = (sources[key] || 0) + 1;
        }
      }
    }

    return sources;
  }

  public async flush(params: SecurityParams = {}): Promise<{ flushed: boolean }> {
    this.validateAccess(params.token, params.callerIp);
    await this.store.delete("metrics");
    return { flushed: true };
  }

  public async delete(params: DeleteParams): Promise<{ deleted: boolean }> {
    this.validateAccess(params.token, params.callerIp);

    const data = await this.loadTelemetryData();

    if (params.date) {
      const dailyVisitors = data.access.visitorsByDate.get(params.date);
      if (dailyVisitors) {
        if (params.ip) {
          // Delete specific IP on specific date
          const visitor = dailyVisitors.get(params.ip);
          if (visitor) {
            data.access.totalRequests -= visitor.totalRequests;
            dailyVisitors.delete(params.ip);
          }
        } else {
          // Delete entire date
          for (const [, visitor] of dailyVisitors) {
            data.access.totalRequests -= visitor.totalRequests;
          }
          data.access.visitorsByDate.delete(params.date);
        }
      }
    } else if (params.ip) {
      // Delete IP from all dates
      for (const [, dailyVisitors] of data.access.visitorsByDate) {
        const visitor = dailyVisitors.get(params.ip);
        if (visitor) {
          data.access.totalRequests -= visitor.totalRequests;
          dailyVisitors.delete(params.ip);
        }
      }
    }

    await this.saveMetrics(data);
    return { deleted: true };
  }

  // --- Collection ---

  public async handleRequest(): Promise<Response | void> {
    if (!this.request || !this.clientIp) {
      throw new Error("Telemetry has not been initialized with request data");
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
          return new Response(null, { status: 204 });
        }
      }

      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      const dateKey = this.getTodayKey();

      const telemetryData = await this.loadTelemetryData();

      if (!telemetryData.access.visitorsByDate.has(dateKey)) {
        telemetryData.access.visitorsByDate.set(dateKey, new Map<string, VisitorData>());
      }

      const dailyVisitors = telemetryData.access.visitorsByDate.get(dateKey)!;

      if (!dailyVisitors.has(clientIp)) {
        if (dailyVisitors.size >= this.maxVisitorsKeys) {
          const firstKey = dailyVisitors.keys().next().value;
          if (firstKey !== undefined) dailyVisitors.delete(firstKey);
        }

        dailyVisitors.set(clientIp, {
          totalRequests: 0,
          visits: [],
        });
      }

      const visitorData = dailyVisitors.get(clientIp)!;

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      visitorData.totalRequests++;
      visitorData.visits.push({
        path,
        timestamp,
        responseTime,
        error: null,
        trafficSource: this.trafficSource || undefined,
      });

      telemetryData.access.totalRequests++;
      telemetryData.behavior.pageViews.set(path, (telemetryData.behavior.pageViews.get(path) || 0) + 1);

      await this.saveMetrics(telemetryData);
    } catch (error) {
      const dateKey = this.getTodayKey();
      const telemetryData = await this.loadTelemetryData();

      if (!telemetryData.access.visitorsByDate.has(dateKey)) {
        telemetryData.access.visitorsByDate.set(dateKey, new Map<string, VisitorData>());
      }

      const dailyVisitors = telemetryData.access.visitorsByDate.get(dateKey)!;

      if (!dailyVisitors.has(clientIp)) {
        if (dailyVisitors.size >= this.maxVisitorsKeys) {
          const firstKey = dailyVisitors.keys().next().value;
          if (firstKey !== undefined) dailyVisitors.delete(firstKey);
        }

        dailyVisitors.set(clientIp, {
          totalRequests: 0,
          visits: [],
        });
      }

      const visitorData = dailyVisitors.get(clientIp)!;
      const url = new URL(this.request.url);

      visitorData.totalRequests++;
      visitorData.visits.push({
        path: url.pathname,
        timestamp: new Date().toISOString(),
        responseTime: 0,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "An error occurred on the server",
        },
        trafficSource: this.trafficSource || undefined,
      });

      telemetryData.access.totalRequests++;
      telemetryData.behavior.pageViews.set(url.pathname, (telemetryData.behavior.pageViews.get(url.pathname) || 0) + 1);

      await this.saveMetrics(telemetryData);

      return new Response(JSON.stringify({ error: "An error occurred on the server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
