import { beforeEach, describe, expect, test, mock } from "bun:test";
import { Response } from "../response";
import { Shield } from "../shield";

describe("Shield", () => {
  let shield: Shield;
  let response: Response;

  beforeEach(() => {
    shield = new Shield();
    response = new Response();
  });

  test("should create a Shield instance with default headers", () => {
    expect((shield as any).headers).toEqual({
      useNonce: false,
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "font-src": ["'self'", "https:", "data:"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'self'"],
          "img-src": ["'self'", "data:"],
          "object-src": ["'none'"],
          "script-src": ["'self'"],
          "script-src-attr": ["'none'"],
          "style-src": ["'self'"],
          "upgrade-insecure-requests": [],
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      originAgentCluster: true,
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: "SAMEORIGIN" },
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: false,
      xXssProtection: false,
    });
  });

  test("should create a Shield instance with custom headers", () => {
    const customHeaders = {
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'none'"],
        },
      },
      crossOriginOpenerPolicy: { policy: "unsafe-none" },
      xPoweredBy: true,
      xXssProtection: true,
    };

    shield = new Shield(customHeaders);

    expect((shield as any).headers).toEqual({
      useNonce: false,
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'none'"],
          "base-uri": ["'self'"],
          "font-src": ["'self'", "https:", "data:"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'self'"],
          "img-src": ["'self'", "data:"],
          "object-src": ["'none'"],
          "script-src": ["'self'"],
          "script-src-attr": ["'none'"],
          "style-src": ["'self'"],
          "upgrade-insecure-requests": [],
        },
      },
      crossOriginOpenerPolicy: { policy: "unsafe-none" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      originAgentCluster: true,
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: "SAMEORIGIN" },
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: true,
      xXssProtection: true,
    });
  });

  test("should apply Content-Security-Policy header", () => {
    (shield as any).applyHeaders(response);

    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; upgrade-insecure-requests",
    );
  });

  test("should apply Cross-Origin-Opener-Policy header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  test("should apply Cross-Origin-Resource-Policy header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  test("should apply Origin-Agent-Cluster header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Origin-Agent-Cluster")).toBe("?1");
  });

  test("should apply Referrer-Policy header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  test("should apply Strict-Transport-Security header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=15552000; includeSubDomains");
  });

  test("should apply X-Content-Type-Options header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  test("should apply X-DNS-Prefetch-Control header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-DNS-Prefetch-Control")).toBe("off");
  });

  test("should apply X-Download-Options header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-Download-Options")).toBe("noopen");
  });

  test("should apply X-Frame-Options header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  test("should apply X-Permitted-Cross-Domain-Policies header", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
  });

  test("should delete X-Powered-By header", () => {
    response.headers.set("X-Powered-By", "Express");
    (shield as any).applyHeaders(response);
    expect(response.headers.has("X-Powered-By")).toBe(false);
  });

  test("should set X-XSS-Protection to 0", () => {
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-XSS-Protection")).toBe("0");
  });

  test("should apply headers with middleware", () => {
    const mockApp = { requestIP: mock(() => "192.168.1.1") };
    const next = mock();
    const middleware = shield.middleware(mockApp as any);

    middleware({} as any, response, next);

    expect(response.headers.get("Content-Security-Policy")).toBeDefined();
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBeDefined();
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBeDefined();
    expect(response.headers.get("Origin-Agent-Cluster")).toBeDefined();
    expect(response.headers.get("Referrer-Policy")).toBeDefined();
    expect(response.headers.get("Strict-Transport-Security")).toBeDefined();
    expect(response.headers.get("X-Content-Type-Options")).toBeDefined();
    expect(response.headers.get("X-DNS-Prefetch-Control")).toBeDefined();
    expect(response.headers.get("X-Download-Options")).toBeDefined();
    expect(response.headers.get("X-Frame-Options")).toBeDefined();
    expect(response.headers.get("X-Permitted-Cross-Domain-Policies")).toBeDefined();
    expect(response.headers.has("X-Powered-By")).toBe(false);
    expect(response.headers.get("X-XSS-Protection")).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  test("should handle boolean false for contentSecurityPolicy", () => {
    const customHeaders = {
      contentSecurityPolicy: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("Content-Security-Policy")).toBe(false);
  });

  test("should handle boolean false for crossOriginOpenerPolicy", () => {
    const customHeaders = {
      crossOriginOpenerPolicy: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("Cross-Origin-Opener-Policy")).toBe(false);
  });

  test("should handle boolean false for crossOriginResourcePolicy", () => {
    const customHeaders = {
      crossOriginResourcePolicy: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("Cross-Origin-Resource-Policy")).toBe(false);
  });

  test("should handle boolean false for referrerPolicy", () => {
    const customHeaders = {
      referrerPolicy: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("Referrer-Policy")).toBe(false);
  });

  test("should handle boolean false for strictTransportSecurity", () => {
    const customHeaders = {
      strictTransportSecurity: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("Strict-Transport-Security")).toBe(false);
  });

  test("should handle boolean false for xDnsPrefetchControl", () => {
    const customHeaders = {
      xDnsPrefetchControl: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("X-DNS-Prefetch-Control")).toBe(false);
  });

  test("should handle boolean false for xFrameOptions", () => {
    const customHeaders = {
      xFrameOptions: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("X-Frame-Options")).toBe(false);
  });

  test("should handle boolean false for xPermittedCrossDomainPolicies", () => {
    const customHeaders = {
      xPermittedCrossDomainPolicies: false,
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.has("X-Permitted-Cross-Domain-Policies")).toBe(false);
  });

  test("should handle custom referrerPolicy array", () => {
    const customHeaders = {
      referrerPolicy: { policy: ["origin", "unsafe-url"] },
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Referrer-Policy")).toBe("origin, unsafe-url");
  });

  test("should handle custom strictTransportSecurity", () => {
    const customHeaders = {
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false, preload: true },
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; preload");
  });

  test("should handle custom xDnsPrefetchControl", () => {
    const customHeaders = {
      xDnsPrefetchControl: { allow: true },
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-DNS-Prefetch-Control")).toBe("on");
  });

  test("should handle custom xFrameOptions", () => {
    const customHeaders = {
      xFrameOptions: { action: "DENY" },
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  test("should handle custom xPermittedCrossDomainPolicies", () => {
    const customHeaders = {
      xPermittedCrossDomainPolicies: { permittedPolicies: "master-only" },
    };
    shield = new Shield(customHeaders);
    (shield as any).applyHeaders(response);
    expect(response.headers.get("X-Permitted-Cross-Domain-Policies")).toBe("master-only");
  });

  test("should apply nonce at Content-Security-Policy header", () => {
    const customHeaders = { useNonce: true };

    shield = new Shield(customHeaders);
    expect((shield as any).headers).toEqual({
      useNonce: true,
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "font-src": ["'self'", "https:", "data:"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'self'"],
          "img-src": ["'self'", "data:"],
          "object-src": ["'none'"],
          "script-src": ["'self'"],
          "script-src-attr": ["'none'"],
          "style-src": ["'self'"],
          "upgrade-insecure-requests": [],
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      originAgentCluster: true,
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: "SAMEORIGIN" },
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: false,
      xXssProtection: false,
    });
  });

  test("should add nonce to script-src and style-src when useNonce is true", () => {
    shield = new Shield({
      useNonce: true,
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'"],
        },
      },
    });

    const nonce = "test-nonce-123";
    (shield as any).applyHeaders(response, nonce);

    const cspHeader = response.headers.get("Content-Security-Policy");
    expect(cspHeader).toContain(`script-src 'self' 'nonce-${nonce}'`);
    expect(cspHeader).toContain(`style-src 'self' 'nonce-${nonce}'`);
  });

  test("should generate and store nonce in middleware", () => {
    shield = new Shield({
      useNonce: true,
    });

    const mockRes = new Response();
    const next = () => {};
    const mockApp = {
      engine: {
        set: mock(),
      },
      requestIP: mock(() => "192.168.1.1"),
    };

    const middleware = shield.middleware(mockApp as any);
    middleware({} as any, mockRes, next);

    const nonce = shield.getNonce("192.168.1.1");
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);

    const cspHeader = mockRes.headers.get("Content-Security-Policy");
    expect(cspHeader).toContain(`'nonce-${nonce}'`);
  });

  test("should delete nonce after retrieval", () => {
    shield = new Shield({
      useNonce: true,
    });

    const ip = "192.168.1.1";

    // Simula o middleware armazenando um nonce
    const testNonce = "test-nonce-456";
    (shield as any).setNonce(ip, testNonce);

    // Primeira recuperação deve retornar o nonce
    const firstRetrieval = shield.getNonce(ip);
    expect(firstRetrieval).toBe(testNonce);

    // Segunda recuperação deve retornar fallback
    const secondRetrieval = shield.getNonce(ip);
    expect(secondRetrieval).toBe("fallback-nonce");
  });

  test("should work with development unsafe-inline and nonce", () => {
    shield = new Shield({
      useNonce: true,
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "'unsafe-inline'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    });

    const nonce = "test-nonce-789";
    (shield as any).applyHeaders(response, nonce);

    const cspHeader = response.headers.get("Content-Security-Policy");
    expect(cspHeader).toContain(`script-src 'self' 'unsafe-inline' 'nonce-${nonce}'`);
    expect(cspHeader).toContain(`style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`);
  });
});
