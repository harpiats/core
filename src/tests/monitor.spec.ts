import { beforeEach, describe, expect, it } from "bun:test";
import { MemoryStore } from "../memory-store";
import { RequestMonitor } from "../monitor";
import type { MonitorInterface } from "../types/monitor";
import type { Store } from "../types/store";

describe("RequestMonitor", () => {
  let monitor: RequestMonitor;
  let mockStore: Store;
  let mockRequest: Request;
  let mockClientIp: string;
  let date: string;

  beforeEach(() => {
    mockStore = new MemoryStore();
    monitor = new RequestMonitor({ store: mockStore });
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
    const defaultMonitor = new RequestMonitor();

    expect((defaultMonitor as any).store).toBeInstanceOf(MemoryStore);
  });

  it("should initialize with provided store", () => {
    expect((monitor as any).store).toBe(mockStore);
  });

  it("should initialize with ignored paths", () => {
    const ignoredPaths = ["/ignored", "/another-ignored"];
    const monitorWithIgnoredPaths = new RequestMonitor({ ignore: ignoredPaths });

    expect((monitorWithIgnoredPaths as any).ignoredPaths).toEqual(ignoredPaths);
  });

  it("should initialize request, clientIp, and trafficSource", async () => {
    const trafficSource = { source: "google", medium: "organic" };
    await monitor.initialize(mockRequest, mockClientIp, trafficSource);

    expect((monitor as any).request).toBe(mockRequest);
    expect((monitor as any).clientIp).toBe(mockClientIp);
    expect((monitor as any).trafficSource).toEqual(trafficSource);
  });

  it("should get client IP from headers", async () => {
    await monitor.initialize(mockRequest, mockClientIp);
    const clientIp = (monitor as any).getClientIp();

    expect(clientIp).toBe("192.168.1.1");
  });

  it("should get client IP from cf-connecting-ip if x-forwarded-for is not present", async () => {
    const request = new Request("http://example.com/test", {
      headers: {
        "cf-connecting-ip": "172.16.0.1",
      },
    });

    const trustedMonitor = new RequestMonitor({ store: mockStore, trustProxy: true });
    await trustedMonitor.initialize(request, mockClientIp);
    const clientIp = (trustedMonitor as any).getClientIp();

    expect(clientIp).toBe("172.16.0.1");
  });

  it("should get client IP from x-real-ip if x-forwarded-for and cf-connecting-ip are not present", async () => {
    const request = new Request("http://example.com/test", {
      headers: {
        "x-real-ip": "10.0.0.2",
      },
    });

    const trustedMonitor = new RequestMonitor({ store: mockStore, trustProxy: true });
    await trustedMonitor.initialize(request, mockClientIp);
    const clientIp = (trustedMonitor as any).getClientIp();

    expect(clientIp).toBe("10.0.0.2");
  });

  it("should get client IP from socket if no headers are present", async () => {
    const request = new Request("http://example.com/test", { headers: {} });
    await monitor.initialize(request, mockClientIp);
    const clientIp = (monitor as any).getClientIp();

    expect(clientIp).toBe(mockClientIp);
  });

  it("should throw an error if monitor is not initialized", async () => {
    expect(() => (monitor as any).getClientIp()).toThrow("Monitor has not been initialized with request data");
  });

  it("should save and get metrics", async () => {
    const metrics: MonitorInterface = {
      access: {
        visitorsByDate: new Map([
          [
            "2023-01-01",
            new Map([["127.0.0.1", { totalRequests: 1, pagesVisited: [], responseTimes: [], errors: 0 }]]),
          ],
        ]),
        totalRequests: 1,
      },
      behavior: {
        pageViews: new Map([["/test", 1]]),
      },
    };

    await monitor.saveMetrics(metrics);
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics).toEqual({
      access: {
        visitorsByDate: {
          "2023-01-01": { "127.0.0.1": { totalRequests: 1, pagesVisited: [], responseTimes: [], errors: 0 } },
        },
        totalRequests: 1,
      },
      behavior: {
        pageViews: { "/test": 1 },
      },
    });
  });

  it("should return default metrics if no metrics are saved", async () => {
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics).toEqual({
      access: { visitorsByDate: {}, totalRequests: 0 },
      behavior: { pageViews: {} },
    });
  });

  it("should handle request and update metrics", async () => {
    await monitor.initialize(mockRequest, mockClientIp);
    await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(1);
    expect(retrievedMetrics.behavior.pageViews["/test"]).toBe(1);
    expect(retrievedMetrics.access.visitorsByDate[date]).toBeDefined();
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].totalRequests).toBe(1);
  });

  it("should handle multiple requests and update metrics", async () => {
    await monitor.initialize(mockRequest, mockClientIp);
    await monitor.handleRequest();
    await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(2);
    expect(retrievedMetrics.behavior.pageViews["/test"]).toBe(2);
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].totalRequests).toBe(2);
  });

  it("should handle request with different paths", async () => {
    await monitor.initialize(mockRequest, mockClientIp);
    await monitor.handleRequest();
    const newRequest = new Request("http://example.com/another", { headers: {} });

    await monitor.initialize(newRequest, mockClientIp);
    await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(2);
    expect(retrievedMetrics.behavior.pageViews["/test"]).toBe(1);
    expect(retrievedMetrics.behavior.pageViews["/another"]).toBe(1);
  });

  it("should handle request with different client IPs", async () => {
    await monitor.initialize(mockRequest, mockClientIp);
    await monitor.handleRequest();
    const newRequest = new Request("http://example.com/test", { headers: {} });
    const newClientIp = "192.168.1.2";

    await monitor.initialize(newRequest, newClientIp);
    await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics.access.totalRequests).toBe(2);
    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].totalRequests).toBe(1);
    expect(retrievedMetrics.access.visitorsByDate[date][newClientIp].totalRequests).toBe(1);
  });

  it("should ignore specified paths", async () => {
    const ignoredPaths = ["/ignored"];
    const monitorWithIgnoredPaths = new RequestMonitor({ ignore: ignoredPaths });
    await monitorWithIgnoredPaths.initialize(new Request("http://example.com/ignored", { headers: {} }), mockClientIp);
    const response = await monitorWithIgnoredPaths.handleRequest();
    const retrievedMetrics = await monitorWithIgnoredPaths.getMetrics();

    expect(response?.status).toBe(204);
    expect(retrievedMetrics.access.totalRequests).toBe(0);
    expect(retrievedMetrics.behavior.pageViews["/ignored"]).toBeUndefined();
  });

  it("should handle errors and update error count", async () => {
    const request = new Request("http://example.com/test", { headers: {} });
    await monitor.initialize(request, "unknown");
    const response = await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(response?.status).toBe(500);
    expect(retrievedMetrics.access.visitorsByDate[date].unknown.errors).toBe(1);
  });

  it("should handle multiple errors and update error count", async () => {
    const request = new Request("http://example.com/test", { headers: {} });
    await monitor.initialize(request, "unknown");
    await monitor.handleRequest();
    await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics.access.visitorsByDate[date].unknown.errors).toBe(2);
  });

  it("should ignore path with or without slash", async () => {
    const ignoredPaths = ["ignored"];
    const monitorWithIgnoredPaths = new RequestMonitor({ ignore: ignoredPaths });
    await monitorWithIgnoredPaths.initialize(new Request("http://example.com/ignored", { headers: {} }), mockClientIp);
    const response = await monitorWithIgnoredPaths.handleRequest();
    const retrievedMetrics = await monitorWithIgnoredPaths.getMetrics();

    expect(response?.status).toBe(204);
    expect(retrievedMetrics.access.totalRequests).toBe(0);
    expect(retrievedMetrics.behavior.pageViews["/ignored"]).toBeUndefined();
  });

  it("should handle request with traffic source", async () => {
    const trafficSource = { source: "google", medium: "organic" };
    await monitor.initialize(mockRequest, mockClientIp, trafficSource);
    await monitor.handleRequest();
    const retrievedMetrics = await monitor.getMetrics();

    expect(retrievedMetrics.access.visitorsByDate[date][mockClientIp].pagesVisited[0].trafficSource).toEqual(
      trafficSource,
    );
  });
});
