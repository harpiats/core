import { beforeEach, describe, expect, it } from "bun:test";
import { MemoryStore } from "../memory-store";
import { Telemetry } from "../telemetry";
import type { TelemetryData } from "../types/telemetry";
import type { Store } from "../types/store";

describe("Telemetry", () => {
  let telemetry: Telemetry;
  let mockStore: Store;
  let mockRequest: Request;
  let mockClientIp: string;
  let date: string;

  beforeEach(() => {
    mockStore = new MemoryStore();
    telemetry = new Telemetry({ store: mockStore });
    mockClientIp = "192.168.1.1";
    mockRequest = new Request("http://example.com/test", {
      headers: {
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        "cf-connecting-ip": "172.16.0.1",
        "x-real-ip": "10.0.0.2",
      },
    });
    date = new Date().toISOString().split("T")[0];
  });

  it("should initialize with default MemoryStore if no store is provided", () => {
    const defaultTelemetry = new Telemetry();
    expect((defaultTelemetry as any).store).toBeInstanceOf(MemoryStore);
  });

  it("should initialize with provided store", () => {
    expect((telemetry as any).store).toBe(mockStore);
  });

  it("should initialize with ignored paths", () => {
    const ignoredPaths = ["/ignored", "/another-ignored"];
    const telemetryWithIgnoredPaths = new Telemetry({ ignore: ignoredPaths });
    expect((telemetryWithIgnoredPaths as any).ignoredPaths).toEqual(ignoredPaths);
  });

  it("should initialize request, clientIp, and trafficSource", async () => {
    const trafficSource = { source: "google", medium: "organic" };
    await telemetry.initialize(mockRequest, mockClientIp, trafficSource);

    expect((telemetry as any).request).toBe(mockRequest);
    expect((telemetry as any).clientIp).toBe(mockClientIp);
    expect((telemetry as any).trafficSource).toEqual(trafficSource);
  });

  it("should get client IP from headers", async () => {
    await telemetry.initialize(mockRequest, mockClientIp);
    const clientIp = (telemetry as any).getClientIp();
    expect(clientIp).toBe("192.168.1.1");
  });

  it("should get client IP from cf-connecting-ip if x-forwarded-for is not present", async () => {
    const request = new Request("http://example.com/test", {
      headers: {
        "cf-connecting-ip": "172.16.0.1",
      },
    });

    const trustedTelemetry = new Telemetry({ store: mockStore, trustProxy: true });
    await trustedTelemetry.initialize(request, mockClientIp);
    const clientIp = (trustedTelemetry as any).getClientIp();

    expect(clientIp).toBe("172.16.0.1");
  });

  it("should get client IP from x-real-ip if x-forwarded-for and cf-connecting-ip are not present", async () => {
    const request = new Request("http://example.com/test", {
      headers: {
        "x-real-ip": "10.0.0.2",
      },
    });

    const trustedTelemetry = new Telemetry({ store: mockStore, trustProxy: true });
    await trustedTelemetry.initialize(request, mockClientIp);
    const clientIp = (trustedTelemetry as any).getClientIp();

    expect(clientIp).toBe("10.0.0.2");
  });

  it("should get client IP from socket if no headers are present", async () => {
    const request = new Request("http://example.com/test", { headers: {} });
    await telemetry.initialize(request, mockClientIp);
    const clientIp = (telemetry as any).getClientIp();

    expect(clientIp).toBe(mockClientIp);
  });

  it("should throw an error if telemetry is not initialized", async () => {
    expect(() => (telemetry as any).getClientIp()).toThrow("Telemetry has not been initialized with request data");
  });

  it("should save and get metrics", async () => {
    const metrics: TelemetryData = {
      access: {
        visitorsByDate: new Map([
          [
            "2023-01-01",
            new Map([["127.0.0.1", { totalRequests: 1, visits: [] }]]),
          ],
        ]),
        totalRequests: 1,
      },
      behavior: {
        pageViews: new Map([["/test", 1]]),
      },
    };

    await telemetry.saveMetrics(metrics);
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics).toEqual({
      access: {
        visitorsByDate: {
          "2023-01-01": { "127.0.0.1": { totalRequests: 1, visits: [] } },
        },
        totalRequests: 1,
      },
      behavior: {
        pageViews: { "/test": 1 },
      },
    });
  });

  it("should return default metrics if no metrics are saved", async () => {
    const retrievedMetrics = await telemetry.getMetrics();
    expect(retrievedMetrics).toEqual({
      access: { visitorsByDate: {}, totalRequests: 0 },
      behavior: { pageViews: {} },
    });
  });

  it("should handle request and update metrics", async () => {
    await telemetry.initialize(mockRequest, mockClientIp);
    await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(1);
    expect(retrievedMetrics.behavior.pageViews["/test"]).toBe(1);
    expect(retrievedMetrics.access.visitorsByDate[date]).toBeDefined();
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].totalRequests).toBe(1);
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].visits[0].error).toBeNull();
  });

  it("should handle multiple requests and update metrics", async () => {
    await telemetry.initialize(mockRequest, mockClientIp);
    await telemetry.handleRequest();
    await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(2);
    expect(retrievedMetrics.behavior.pageViews["/test"]).toBe(2);
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].totalRequests).toBe(2);
  });

  it("should handle request with different paths", async () => {
    await telemetry.initialize(mockRequest, mockClientIp);
    await telemetry.handleRequest();
    const newRequest = new Request("http://example.com/another", { headers: {} });

    await telemetry.initialize(newRequest, mockClientIp);
    await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(2);
    expect(retrievedMetrics.behavior.pageViews["/test"]).toBe(1);
    expect(retrievedMetrics.behavior.pageViews["/another"]).toBe(1);
  });

  it("should handle request with different client IPs", async () => {
    await telemetry.initialize(mockRequest, mockClientIp);
    await telemetry.handleRequest();
    const newRequest = new Request("http://example.com/test", { headers: {} });
    const newClientIp = "192.168.1.2";

    await telemetry.initialize(newRequest, newClientIp);
    await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(2);
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].totalRequests).toBe(1);
    expect(retrievedMetrics.access.visitorsByDate[date][newClientIp].totalRequests).toBe(1);
  });

  it("should ignore specified paths", async () => {
    const ignoredPaths = ["/ignored"];
    const telemetryWithIgnoredPaths = new Telemetry({ ignore: ignoredPaths });
    await telemetryWithIgnoredPaths.initialize(new Request("http://example.com/ignored", { headers: {} }), mockClientIp);
    const response = await telemetryWithIgnoredPaths.handleRequest();
    const retrievedMetrics = await telemetryWithIgnoredPaths.getMetrics();

    expect(response?.status).toBe(204);
    expect(retrievedMetrics.access.totalRequests).toBe(0);
    expect(retrievedMetrics.behavior.pageViews["/ignored"]).toBeUndefined();
  });

  it("should handle errors and log them inside visits", async () => {
    const request = new Request("http://example.com/test", { headers: {} });
    await telemetry.initialize(request, "unknown");
    const response = await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(response?.status).toBe(500);
    const visitor = retrievedMetrics.access.visitorsByDate[date].unknown;
    expect(visitor.totalRequests).toBe(1);
    expect(visitor.visits[0].error).not.toBeNull();
    expect(visitor.visits[0].error?.code).toBe(500);
    expect(visitor.visits[0].error?.message).toBe("Invalid client IP");
  });

  it("should handle multiple errors and update error count in visits", async () => {
    const request = new Request("http://example.com/test", { headers: {} });
    await telemetry.initialize(request, "unknown");
    await telemetry.handleRequest();
    await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics.access.visitorsByDate[date].unknown.visits.length).toBe(2);
    expect(retrievedMetrics.access.visitorsByDate[date].unknown.visits[0].error).not.toBeNull();
    expect(retrievedMetrics.access.visitorsByDate[date].unknown.visits[1].error).not.toBeNull();
  });

  it("should handle request with traffic source", async () => {
    const trafficSource = { source: "google", medium: "organic" };
    await telemetry.initialize(mockRequest, mockClientIp, trafficSource);
    await telemetry.handleRequest();
    const retrievedMetrics = await telemetry.getMetrics();

    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].visits[0].trafficSource).toEqual(trafficSource);
  });

  describe("getAll", () => {
    it("should return all metrics", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const result = await telemetry.getAll();
      expect(result.access.totalRequests).toBe(1);
    });
  });

  describe("summary", () => {
    it("should return a summary for today", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const result = await telemetry.summary();

      expect(result.date).toBe(date);
      expect(result.totalRequests).toBe(1);
      expect(result.uniqueVisitors).toBe(1);
      expect(result.topPages.length).toBeGreaterThan(0);
      expect(result.totalErrors).toBe(0);
      expect(typeof result.avgResponseTime).toBe("number");
    });

    it("should limit topPages in summary", async () => {
      const store = new MemoryStore();
      const t = new Telemetry({ store });

      await store.set("metrics", {
        access: {
          visitorsByDate: {
            [date]: {
              "10.0.0.1": {
                totalRequests: 3,
                visits: [
                  { path: "/about", timestamp: new Date().toISOString(), responseTime: 10, error: null },
                  { path: "/home", timestamp: new Date().toISOString(), responseTime: 20, error: null },
                  { path: "/pricing", timestamp: new Date().toISOString(), responseTime: 30, error: null },
                ],
              },
            },
          },
          totalRequests: 3,
        },
        behavior: { pageViews: { "/home": 1, "/about": 1, "/pricing": 1 } },
      });

      const result = await t.summary({ limit: 2 });
      expect(result.topPages.length).toBe(2);
    });

    it("should return a summary for a specific date", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const result = await telemetry.summary({ date: "2099-01-01" });

      expect(result.date).toBe("2099-01-01");
      expect(result.totalRequests).toBe(0);
      expect(result.uniqueVisitors).toBe(0);
    });
  });

  describe("getDailyStats", () => {
    it("should return stats grouped by day", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const stats = await telemetry.getDailyStats();

      expect(stats.length).toBe(1);
      expect(stats[0].date).toBe(date);
      expect(stats[0].totalRequests).toBe(1);
      expect(stats[0].uniqueVisitors).toBe(1);
    });

    it("should return empty array when no data", async () => {
      const stats = await telemetry.getDailyStats();
      expect(stats).toEqual([]);
    });
  });

  describe("getVisitors", () => {
    it("should return visitors for today", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const visitors = await telemetry.getVisitors();

      expect(visitors[mockClientIp]).toBeDefined();
      expect(visitors[mockClientIp].totalRequests).toBe(1);
    });
  });

  describe("getVisitorByIp", () => {
    it("should return visitor data for a specific IP", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const visitor = await telemetry.getVisitorByIp({ ip: mockClientIp });

      expect(visitor).not.toBeNull();
      expect(visitor!.totalRequests).toBe(1);
    });
  });

  describe("countUniqueVisitors", () => {
    it("should count unique visitors for today", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const count = await telemetry.countUniqueVisitors();
      expect(count).toBe(1);
    });
  });

  describe("getPageViews", () => {
    it("should return page views for today", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const views = await telemetry.getPageViews();
      expect(views["/test"]).toBe(1);
    });
  });

  describe("getTopPages", () => {
    it("should return top pages sorted by views", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      await telemetry.handleRequest();

      const newRequest = new Request("http://example.com/another", { headers: {} });
      await telemetry.initialize(newRequest, mockClientIp);
      await telemetry.handleRequest();

      const top = await telemetry.getTopPages({ limit: 2 });
      expect(top.length).toBe(2);
      expect(top[0].path).toBe("/test");
      expect(top[0].views).toBe(2);
      expect(top[1].path).toBe("/another");
      expect(top[1].views).toBe(1);
    });
  });

  describe("getPageByPath", () => {
    it("should return page data for a specific path including avgResponseTime and errorCount", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const page = await telemetry.getPageByPath({ path: "/test" });

      expect(page).not.toBeNull();
      expect(page!.path).toBe("/test");
      expect(page!.views).toBe(1);
      expect(page!.visitors).toContain(mockClientIp);
      expect(typeof page!.avgResponseTime).toBe("number");
      expect(page!.errorCount).toBe(0);
    });
  });

  describe("getAvgResponseTime", () => {
    it("should return average response time", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const avg = await telemetry.getAvgResponseTime();

      expect(typeof avg).toBe("number");
      expect(avg).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getSlowRequests", () => {
    it("should return slow requests above threshold with path and timestamp", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      const slow = await telemetry.getSlowRequests({ threshold: -1 });

      expect(slow.length).toBeGreaterThanOrEqual(1);
      expect(slow[0].ip).toBe(mockClientIp);
      expect(slow[0].path).toBe("/test");
      expect(typeof slow[0].responseTime).toBe("number");
      expect(typeof slow[0].timestamp).toBe("string");
    });

    it("should sort slow requests by response time descending", async () => {
      const store = new MemoryStore();
      const t = new Telemetry({ store });

      await store.set("metrics", {
        access: {
          visitorsByDate: {
            [date]: {
              "10.0.0.1": {
                totalRequests: 3,
                visits: [
                  { path: "/fast", timestamp: "2023-10-25T14:00:00.000Z", responseTime: 50, error: null },
                  { path: "/slow", timestamp: "2023-10-25T14:01:00.000Z", responseTime: 500, error: null },
                  { path: "/medium", timestamp: "2023-10-25T14:02:00.000Z", responseTime: 200, error: null },
                ]
              }
            }
          },
          totalRequests: 3
        },
        behavior: { pageViews: {} }
      });

      const slow = await t.getSlowRequests({ threshold: 10 });
      expect(slow.length).toBe(3);
      expect(slow[0].responseTime).toBe(500);
      expect(slow[1].responseTime).toBe(200);
      expect(slow[2].responseTime).toBe(50);
    });
  });

  describe("getErrors", () => {
    it("should return IPs with error details", async () => {
      const request = new Request("http://example.com/test", { headers: {} });
      await telemetry.initialize(request, "unknown");
      await telemetry.handleRequest();
      const errors = await telemetry.getErrors();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].ip).toBe("unknown");
      expect(errors[0].error).not.toBeNull();
      expect(errors[0].path).toBe("/test");
    });

    it("should sort errors by timestamp descending (newest first)", async () => {
      const store = new MemoryStore();
      const t = new Telemetry({ store });

      await store.set("metrics", {
        access: {
          visitorsByDate: {
            [date]: {
              "10.0.0.1": {
                totalRequests: 3,
                visits: [
                  { path: "/first", timestamp: "2023-10-25T14:00:00.000Z", responseTime: 50, error: { code: 500, message: "A" } },
                  { path: "/last", timestamp: "2023-10-25T14:10:00.000Z", responseTime: 50, error: { code: 500, message: "C" } },
                  { path: "/middle", timestamp: "2023-10-25T14:05:00.000Z", responseTime: 50, error: { code: 500, message: "B" } },
                ]
              }
            }
          },
          totalRequests: 3
        },
        behavior: { pageViews: {} }
      });

      const errors = await t.getErrors();
      expect(errors.length).toBe(3);
      expect(errors[0].path).toBe("/last");
      expect(errors[1].path).toBe("/middle");
      expect(errors[2].path).toBe("/first");
    });
  });

  describe("countErrors", () => {
    it("should count total errors", async () => {
      const request = new Request("http://example.com/test", { headers: {} });
      await telemetry.initialize(request, "unknown");
      await telemetry.handleRequest();
      const count = await telemetry.countErrors();

      expect(count).toBe(1);
    });
  });

  describe("getTrafficSources", () => {
    it("should group traffic by utm source/medium", async () => {
      const trafficSource = { utm: { source: "google", medium: "organic" } };
      await telemetry.initialize(mockRequest, mockClientIp, trafficSource);
      await telemetry.handleRequest();
      const sources = await telemetry.getTrafficSources();

      expect(sources["google/organic"]).toBe(1);
    });

    it("should filter traffic by source if provided", async () => {
      const store = new MemoryStore();
      const t = new Telemetry({ store });

      await store.set("metrics", {
        access: {
          visitorsByDate: {
            [date]: {
              "10.0.0.1": {
                totalRequests: 2,
                visits: [
                  { path: "/home", timestamp: "", responseTime: 10, error: null, trafficSource: { utm: { source: "google", medium: "cpc" } } },
                  { path: "/home", timestamp: "", responseTime: 10, error: null, trafficSource: { utm: { source: "twitter", medium: "organic" } } },
                ],
              },
            },
          },
          totalRequests: 2,
        },
        behavior: { pageViews: {} },
      });

      const filtered = await t.getTrafficSources({ source: "google" });
      expect(filtered["google/cpc"]).toBe(1);
      expect(filtered["twitter/organic"]).toBeUndefined();
    });
  });

  describe("flush", () => {
    it("should clear all metrics from the store", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      await telemetry.flush();

      const result = await telemetry.getAll();
      expect(result.access.totalRequests).toBe(0);
    });
  });

  describe("delete", () => {
    it("should delete by date", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      await telemetry.delete({ date });

      const stats = await telemetry.getDailyStats();
      expect(stats.length).toBe(0);
    });

    it("should delete by ip", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();
      await telemetry.delete({ ip: mockClientIp });

      const visitors = await telemetry.getVisitors();
      expect(visitors[mockClientIp]).toBeUndefined();
    });

    it("should delete by both ip and date", async () => {
      await telemetry.initialize(mockRequest, mockClientIp);
      await telemetry.handleRequest();

      const newRequest = new Request("http://example.com/test", { headers: {} });
      await telemetry.initialize(newRequest, "10.0.0.5");
      await telemetry.handleRequest();

      await telemetry.delete({ ip: mockClientIp, date });

      const visitors = await telemetry.getVisitors();
      expect(visitors[mockClientIp]).toBeUndefined();
      expect(visitors["10.0.0.5"]).toBeDefined();
    });
  });

  describe("security", () => {
    it("should reject access with invalid token", async () => {
      const secured = new Telemetry({ store: mockStore, accessToken: "my-secret" });
      expect(secured.summary({ token: "wrong" })).rejects.toThrow("Unauthorized: invalid access token");
    });

    it("should reject access from disallowed IP", async () => {
      const secured = new Telemetry({ store: mockStore, allowedIps: ["127.0.0.1"] });
      expect(secured.summary({ callerIp: "10.10.10.10" })).rejects.toThrow("Unauthorized: IP not allowed");
    });
  });
});
