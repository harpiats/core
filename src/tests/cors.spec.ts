import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Cors } from "../cors";
import { Response } from "../response";

describe("Cors", () => {
  let cors: Cors;
  let mockRequest: any;
  let mockResponse: Response;
  let next: any;

  beforeEach(() => {
    cors = new Cors();
    mockRequest = {
      headers: {
        get: mock((headerName: string) => {
          if (headerName === "Origin") {
            return "http://example.com";
          }
          return null;
        }),
      },
      method: "GET",
    };
    mockResponse = new Response();
    next = mock();
  });

  it("should allow all origins when origin is true", () => {
    cors.options = { origin: true };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("should allow specific origin when origin is a string", () => {
    cors.options = { origin: "http://example.com" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
  });

  it("should not allow origin when origin is a string and request origin is different", () => {
    mockRequest.headers.get = mock(() => "http://different.com");
    cors.options = { origin: "http://example.com" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(403);
  });

  it("should allow origin when origin is a regex and request origin matches", () => {
    cors.options = { origin: /example\.com$/ };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
  });

  it("should not allow origin when origin is a regex and request origin does not match", () => {
    mockRequest.headers.get = mock(() => "http://different.com");
    cors.options = { origin: /example\.com$/ };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(403);
  });

  it("should allow origin when origin is an array and request origin matches", () => {
    cors.options = { origin: ["http://example.com", "http://another.com"] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
  });

  it("should allow origin when origin is an array with regex and request origin matches", () => {
    cors.options = { origin: ["http://another.com", /example\.com$/] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
  });

  it("should not allow origin when origin is an array and request origin does not match", () => {
    mockRequest.headers.get = mock(() => "http://different.com");
    cors.options = { origin: ["http://example.com", "http://another.com"] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(403);
  });

  it("should allow origin when origin is a function and it calls back with an origin", () => {
    cors.options = {
      origin: (reqOrigin: string, callback: (err: Error | undefined, resultOrigin: string | undefined) => void) => {
        callback(undefined, reqOrigin);
      },
    };

    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
  });

  it("should not allow origin when origin is a function and it calls back without an origin", () => {
    cors.options = {
      origin: (_reqOrigin: string, callback: (err: Error | undefined, resultOrigin: string | undefined) => void) => {
        callback(undefined, undefined);
      },
    };

    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(403);
  });

  it("should handle error when origin is a function and it calls back with an error", () => {
    cors.options = {
      origin: (_reqOrigin: string, callback: (err: Error | undefined, resultOrigin: string | undefined) => void) => {
        callback(new Error("Test Error"), undefined);
      },
    };

    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(403);
  });

  it("should allow all methods when methods is '*'", () => {
    cors.options = { methods: "*" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.parse().status).toBe(200);
  });

  it("should allow specific method when methods is an array and request method matches", () => {
    cors.options = { methods: ["GET", "POST"] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.parse().status).toBe(200);
  });

  it("should not allow method when methods is an array and request method does not match", () => {
    mockRequest.method = "PUT";
    cors.options = { methods: ["GET", "POST"] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(405);
  });

  it("should allow specific method when methods is a string and request method matches", () => {
    cors.options = { methods: "GET" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.parse().status).toBe(200);
  });

  it("should not allow method when methods is a string and request method does not match", () => {
    mockRequest.method = "PUT";
    cors.options = { methods: "GET" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(405);
  });

  it("should set allowed headers", () => {
    cors.options = { allowedHeaders: ["Content-Type", "Authorization"] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type,Authorization");
  });

  it("should set allowed headers when is a string", () => {
    cors.options = { allowedHeaders: "Content-Type" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  it("should set exposed headers", () => {
    cors.options = { exposedHeaders: ["Content-Length", "X-Custom-Header"] };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Expose-Headers")).toBe("Content-Length,X-Custom-Header");
  });

  it("should set exposed headers when is a string", () => {
    cors.options = { exposedHeaders: "Content-Length" };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Expose-Headers")).toBe("Content-Length");
  });

  it("should set credentials", () => {
    cors.options = { credentials: true };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("should set max age", () => {
    cors.options = { maxAge: 3600 };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(mockResponse.headers.get("Access-Control-Max-Age")).toBe("3600");
  });

  it("should handle preflight request and not continue when preflightContinue is false", () => {
    mockRequest.method = "OPTIONS";
    cors.options = { preflightContinue: false };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(204);
  });

  it("should handle preflight request and continue when preflightContinue is true", () => {
    mockRequest.method = "OPTIONS";
    cors.options = { preflightContinue: true };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it("should handle preflight request with custom success status", () => {
    mockRequest.method = "OPTIONS";
    cors.options = { preflightContinue: false, optionsSuccessStatus: 200 };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(200);
  });

  it("should return true if no options are set", () => {
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(true);
  });

  it("should return false if origin is not allowed and no origin is sent", () => {
    mockRequest.headers.get = mock(() => null);
    cors.options = { origin: false };
    const result = cors.setCors(mockRequest, mockResponse, next);

    expect(result).toBe(false);
    expect(mockResponse.parse().status).toBe(403);
  });
});
