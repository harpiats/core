import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { Cors } from "../cors";
import { Middleware } from "../middlewares";
import { Request } from "../request";
import { Response } from "../response";
import { Router } from "../router";
import harpia from "../../index";
import type { Application } from "../server";
import { WebSocket } from "../websocket";

import type { MethodOptions } from "src/types/router";
import type { Engine } from "../types/engine";

describe("Server", () => {
  let app: Application;
  let mockServer: any;
  let mockRequest: any;
  let mockResponse: any;
  let mockFile: any;

  beforeEach(() => {
    app = harpia();
    mockServer = {
      requestIP: mock(() => ({ address: "127.0.0.1" })),
      stop: mock(),
      upgrade: mock(() => false),
    };
    mockRequest = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers(),
      text: mock(() => Promise.resolve("")),
    };
    mockResponse = new Response();
    mockFile = {
      exists: mock(),
      type: "text/html",
      arrayBuffer: mock(() => Promise.resolve(new ArrayBuffer(0))),
    };
    spyOn(Bun, "file").mockReturnValue(mockFile);

    // Clear any existing routes, middlewares, etc.
    (app as any).router = new Router();
    (app as any).middlewares = new Middleware();
    (app as any).corsInstance = new Cors();
    (app as any).notFound = null;
    (app as any).staticPath = null;
    (app as any).templateEngine = null;
    (app as any).websocket = new WebSocket();
    (app as any).serverInstance = null;
    (app as any).ipAdress = null;
    (app as any).setTemplateEngine(null);
  });

  afterEach(() => {
    app.stop();
  });

  describe("listen", () => {
    it("should throw an error if neither port nor unix is specified", () => {
      expect(() => app.listen({})).toThrow("Either 'port' or 'unix' must be specified in ServerOptions.");
    });

    it("should throw an error if both port and unix are specified", () => {
      expect(() => app.listen({ port: 3000, unix: "/tmp/socket" })).toThrow(
        "Cannot specify both 'port' and 'unix'. Choose one.",
      );
    });

    it("should throw an error if port is not a number", () => {
      expect(() => app.listen({ port: "3000" as any })).toThrow("'port' must be a number between 1 and 65535.");
    });

    it("should throw an error if port is less than 1", () => {
      expect(() => app.listen({ port: 0 })).toThrow("Either 'port' or 'unix' must be specified in ServerOptions.");
    });

    it("should throw an error if port is greater than 65535", () => {
      expect(() => app.listen({ port: 65536 })).toThrow("'port' must be a number between 1 and 65535.");
    });

    it("should throw an error if hostname is used with unix", () => {
      expect(() => app.listen({ unix: "/tmp/socket", hostname: "localhost" })).toThrow(
        "'hostname' cannot be used with 'unix'.",
      );
    });

    it("should throw an error if tls is used with unix", () => {
      expect(() => app.listen({ unix: "/tmp/socket", tls: {} })).toThrow(
        "'tls' cannot be used with 'unix'. TLS is only applicable to TCP connections.",
      );
    });

    it("should start the server with port", () => {
      const serveSpy = spyOn(Bun, "serve");
      app.listen({ port: 3000 });

      expect(serveSpy).toHaveBeenCalled();
      expect((serveSpy.mock.calls[0][0] as any).port).toBe(3000);
      serveSpy.mockRestore();
    });

    it("should start the server with unix socket", () => {
      const serveSpy = spyOn(Bun, "serve");
      app.listen({ unix: "/tmp/socket" });

      expect(serveSpy).toHaveBeenCalled();
      expect((serveSpy.mock.calls[0][0] as any).unix).toBe("/tmp/socket");
      serveSpy.mockRestore();
    });

    it("should call the handler if provided", () => {
      const handler = mock();
      app.listen({ port: 3000 }, handler);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("ws", () => {
    it("should register a websocket route", () => {
      const registerSpy = spyOn((app as any).websocket, "ws");
      const handlers = { open: () => {}, message: () => {}, close: () => {}, drain: () => {}, error: () => {} };
      app.ws("/ws", handlers);

      expect(registerSpy).toHaveBeenCalledWith("/ws", handlers);
      registerSpy.mockRestore();
    });
  });

  describe("stop", () => {
    it("should stop the server", () => {
      (app as any).serverInstance = mockServer;
      app.stop();
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it("should not throw an error if the server is not running", () => {
      (app as any).serverInstance = null;
      expect(() => app.stop()).not.toThrow();
    });
  });

  describe("server", () => {
    it("should return the server instance", () => {
      (app as any).serverInstance = mockServer;
      expect(app.server()).toBe(mockServer);
    });

    it("should throw an error if the server is not running", () => {
      (app as any).serverInstance = null;
      expect(() => app.server()).toThrow("Server is not running.");
    });
  });

  describe("requestIP", () => {
    it("should return the request IP", () => {
      (app as any).ipAdress = "192.168.1.1";
      expect(app.requestIP()).toBe("192.168.1.1");
    });

    it("should return null if no request IP is set", () => {
      (app as any).ipAdress = null;
      expect(app.requestIP()).toBeNull();
    });
  });

  describe("routes", () => {
    it("should register routes", () => {
      const registerSpy = spyOn((app as any).router, "register");
      const router = new Router();
      const handlers = { open: () => {}, message: () => {}, close: () => {}, drain: () => {}, error: () => {} };

      router.get("/test", () => {});
      router.ws("/ws", handlers);

      app.routes(router);
      expect(registerSpy).toHaveBeenCalled();

      registerSpy.mockRestore();
    });
  });

  describe("use", () => {
    it("should register a global middleware", () => {
      const setSpy = spyOn((app as any).middlewares, "set");
      const handler = () => {};
      app.use(handler);
      expect(setSpy).toHaveBeenCalledWith("*", handler);
      setSpy.mockRestore();
    });

    it("should register a route-specific middleware", () => {
      const setSpy = spyOn((app as any).middlewares, "set");
      const handler = () => {};
      app.use("/test", handler);
      expect(setSpy).toHaveBeenCalledWith("/test", handler);
      setSpy.mockRestore();
    });
  });

  describe("cors", () => {
    it("should set cors options", () => {
      const options = { origin: "*" };
      app.cors(options);
      expect((app as any).corsInstance.options).toEqual(options);
    });

    it("should set cors options to null if no options are provided", () => {
      app.cors();
      expect((app as any).corsInstance.options).toBeNull();
    });
  });

  describe("setNotFound", () => {
    it("should set the not found handler", () => {
      const handler = () => {};
      app.setNotFound(handler);
      expect((app as any).notFound.handler).toBe(handler);
      expect((app as any).notFound.methods).toBeUndefined();
    });

    it("should set the not found handler and methods", () => {
      const handler = () => {};
      const methods = ["GET", "POST"] as MethodOptions[];

      app.setNotFound(handler, methods);

      expect((app as any).notFound.handler).toBe(handler);
      expect((app as any).notFound.methods).toEqual(methods);
    });
  });

  describe("shield", () => {
    it("should initialize shieldInstance and register middleware", () => {
      const useSpy = spyOn(app as any, "use").mockImplementation((middleware: any) => {
        if (typeof middleware === "function") {
          middleware({} as any, new Response() as any, () => {});
        }
      });
      const requestIPSpy = spyOn(app as any, "requestIP").mockReturnValue("127.0.0.1");

      app.shield({ useNonce: true });
      expect((app as any).shieldInstance).toBeDefined();
      expect(useSpy).toHaveBeenCalled();
      expect(requestIPSpy).toHaveBeenCalled();

      useSpy.mockRestore();
      requestIPSpy.mockRestore();
    });

    it("should return nonce if shield is configured", () => {
      app.shield({ useNonce: true });
      (app as any).ipAdress = "192.168.1.1";

      const middleware = (app as any).shieldInstance.middleware((req: any) => "192.168.1.1");
      middleware({} as any, new Response() as any, () => {});

      const nonce = app.getNonce();
      expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should return null nonce if shield is not configured", () => {
      expect(app.getNonce()).toBeNull();
    });
  });

  describe("static", () => {
    it("should set the static path", () => {
      app.static("/public");
      expect((app as any).staticPath).toBe("/public");
    });
  });

  describe("HTTP methods", () => {
    it("should register a GET route", () => {
      const getSpy = spyOn((app as any).router, "get");
      const handler = () => {};
      app.get("/test", handler);
      expect(getSpy).toHaveBeenCalledWith("/test", handler);
      getSpy.mockRestore();
    });

    it("should register a POST route", () => {
      const postSpy = spyOn((app as any).router, "post");
      const handler = () => {};
      app.post("/test", handler);
      expect(postSpy).toHaveBeenCalledWith("/test", handler);
      postSpy.mockRestore();
    });

    it("should register a PUT route", () => {
      const putSpy = spyOn((app as any).router, "put");
      const handler = () => {};
      app.put("/test", handler);
      expect(putSpy).toHaveBeenCalledWith("/test", handler);
      putSpy.mockRestore();
    });

    it("should register a DELETE route", () => {
      const deleteSpy = spyOn((app as any).router, "delete");
      const handler = () => {};
      app.delete("/test", handler);
      expect(deleteSpy).toHaveBeenCalledWith("/test", handler);
      deleteSpy.mockRestore();
    });

    it("should register a PATCH route", () => {
      const patchSpy = spyOn((app as any).router, "patch");
      const handler = () => {};
      app.patch("/test", handler);
      expect(patchSpy).toHaveBeenCalledWith("/test", handler);
      patchSpy.mockRestore();
    });

    it("should register a OPTIONS route", () => {
      const optionsSpy = spyOn((app as any).router, "options");
      const handler = () => {};
      app.options("/test", handler);
      expect(optionsSpy).toHaveBeenCalledWith("/test", handler);
      optionsSpy.mockRestore();
    });

    it("should register a HEAD route", () => {
      const headSpy = spyOn((app as any).router, "head");
      const handler = () => {};
      app.head("/test", handler);
      expect(headSpy).toHaveBeenCalledWith("/test", handler);
      headSpy.mockRestore();
    });
  });

  describe("processRequest", () => {
    it("should call handleRequest", async () => {
      const handleRequestSpy = spyOn(app as any, "handleRequest").mockImplementation(async () => mockResponse.parse());
      await app.processRequest(mockRequest);
      expect(handleRequestSpy).toHaveBeenCalled();
      handleRequestSpy.mockRestore();
    });
  });

  describe("handleRequest", () => {
    it("should set the request IP", async () => {
      const setRequestIPSpy = spyOn(app as any, "setRequestIP");
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(setRequestIPSpy).toHaveBeenCalledWith(mockRequest, mockServer);
      setRequestIPSpy.mockRestore();
    });

    it("should return a response if the request is a WebSocket upgrade", async () => {
      mockServer.upgrade.mockImplementationOnce(() => true);
      mockRequest.headers.set("Cookie", "session_id=123; theme=dark");

      const result = await (app as any).handleRequest(mockRequest, mockServer);

      expect(result).toBeDefined();
      expect(mockServer.upgrade).toHaveBeenCalledWith(mockRequest, {
        data: { url: mockRequest.url, cookies: { session_id: "123", theme: "dark" } },
      });
    });

    it("should handle cors", async () => {
      const setCorsSpy = spyOn((app as any).corsInstance, "setCors").mockImplementation(() => true);
      (app as any).corsInstance.options = { origin: "*" };
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(setCorsSpy).toHaveBeenCalled();
      setCorsSpy.mockRestore();
    });

    it("should return a response if cors is not allowed", async () => {
      spyOn((app as any).corsInstance, "setCors").mockImplementation((req: any, res: any, next: any) => {
        if (next) next();
        return false;
      });
      (app as any).corsInstance.options = { origin: "http://example.com" };
      const result = await (app as any).handleRequest(mockRequest, mockServer);
      expect(result).toBeDefined();
    });

    it("should call methodOverride", async () => {
      const methodOverrideSpy = spyOn(app as any, "methodOverride").mockImplementation(
        async () =>
          new Request(mockRequest, {}, mockRequest.url, new URL(mockRequest.url).pathname, mockRequest.method),
      );
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(methodOverrideSpy).toHaveBeenCalled();
      methodOverrideSpy.mockRestore();
    });

    it("should call resolveStaticFiles", async () => {
      const resolveStaticFilesSpy = spyOn(app as any, "resolveStaticFiles").mockImplementation(async () => false);
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(resolveStaticFilesSpy).toHaveBeenCalled();
      resolveStaticFilesSpy.mockRestore();
    });

    it("should call resolveNotFound if no route is found", async () => {
      const resolveNotFoundSpy = spyOn(app as any, "resolveNotFound").mockImplementation(() => {});
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(resolveNotFoundSpy).toHaveBeenCalled();
      resolveNotFoundSpy.mockRestore();
    });

    it("should return a response if a static file is found", async () => {
      const resolveStaticFilesSpy = spyOn(app as any, "resolveStaticFiles").mockImplementation(async () => true);
      (app as any).staticPath = "/public";

      const result = await (app as any).handleRequest(mockRequest, mockServer);
      expect(result).toBeDefined();

      resolveStaticFilesSpy.mockRestore();
    });

    it("should execute global middlewares", async () => {
      const executeHandlersSpy = spyOn(app as any, "executeHandlers").mockImplementation(async () => undefined);
      const handler = () => {};
      app.use(handler);
      (app as any).router.get("/test", handler);
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(executeHandlersSpy).toHaveBeenCalled();
      executeHandlersSpy.mockRestore();
    });

    it("should execute route middlewares", async () => {
      const executeHandlersSpy = spyOn(app as any, "executeHandlers").mockImplementation(async () => undefined);
      const handler = () => {};
      (app as any).router.get("/test", handler, handler);
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(executeHandlersSpy).toHaveBeenCalled();
      executeHandlersSpy.mockRestore();
    });

    it("should execute the controller", async () => {
      const controller = mock(async (req: any, res: any, next: any) => {
        if (next) await next();
      });
      (app as any).router.get("/test", controller);
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(controller).toHaveBeenCalled();
    });
  });

  describe("executeHandlers", () => {
    it("should return true if no handlers are provided", async () => {
      const result = await (app as any).executeHandlers([], mockRequest, new Response());
      expect(result).toBe(true);
    });

    it("should throw error if handler is not a function", async () => {
      expect((app as any).executeHandlers(["not a function"], mockRequest, new Response())).rejects.toThrow("Middleware handler must be a function.");
    });

    it("should call handlers in order and proceed if next() is called", async () => {
      const order: number[] = [];
      const h1 = async (req: any, res: any, next: any) => {
        order.push(1);
        await next();
      };
      const h2 = async (req: any, res: any, next: any) => {
        order.push(2);
        await next();
      };
      const result = await (app as any).executeHandlers([h1, h2], mockRequest, new Response());
      expect(order).toEqual([1, 2]);
      expect(result).toBeUndefined();
    });

    it("should return false if next() is not called and handler does not return Response", async () => {
      const h1 = async (req: any, res: any, next: any) => {
        // next not called
      };
      const result = await (app as any).executeHandlers([h1], mockRequest, new Response());
      expect(result).toBe(false);
    });

    it("should return Response if a handler returns Response", async () => {
      const customResponse = new Response();
      const h1 = async (req: any, res: any, next: any) => {
        return customResponse;
      };
      const result = await (app as any).executeHandlers([h1], mockRequest, new Response());
      expect(result).toBe(customResponse);
    });

    it("should throw error if next() is called multiple times", async () => {
      const h1 = async (req: any, res: any, next: any) => {
        await next();
        await next();
      };
      expect((app as any).executeHandlers([h1], mockRequest, new Response())).rejects.toThrow("next() called multiple times");
    });
    
    it("should throw an error if error is passed to next()", async () => {
      const h1 = async (req: any, res: any, next: any) => {
        await next(new Error("Next error"));
      };
      expect((app as any).executeHandlers([h1], mockRequest, new Response())).rejects.toThrow("Next error");
    });
  });

  describe("resolveNotFound", () => {
    it("should call the not found handler", () => {
      const handler = mock((req: any, res: any, next: any) => {
        if (next) next();
      });
      app.setNotFound(handler);
      (app as any).resolveNotFound(mockRequest, mockResponse, "/test");
      expect(handler).toHaveBeenCalled();
    });

    it("should call the not found handler if the method matches", () => {
      const handler = mock((req: any, res: any, next: any) => {
        if (next) next();
      });
      const methods = ["GET"] as MethodOptions[];

      app.setNotFound(handler, methods);
      (app as any).resolveNotFound(mockRequest, mockResponse, "/test");
      expect(handler).toHaveBeenCalled();
    });

    it("should not call the not found handler if the method does not match", () => {
      const handler = mock();
      const methods = ["POST"] as MethodOptions[];
      app.setNotFound(handler, methods);
      (app as any).resolveNotFound(mockRequest, mockResponse, "/test");
      expect(handler).not.toHaveBeenCalled();
    });

    it("should not call the not found handler if no not found handler is set", () => {
      const handler = mock();
      (app as any).resolveNotFound(mockRequest, mockResponse, "/test");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("resolveStaticFiles", () => {
    it("should return null if no static path is set", async () => {
      const result = await (app as any).resolveStaticFiles("/test");
      expect(result).toBeNull();
    });

    it("should return null if the file does not exist", async () => {
      (app as any).staticPath = "/public";
      mockFile.exists.mockResolvedValue(false);
      const result = await (app as any).resolveStaticFiles("/test.html");
      expect(result).toBeNull();
    });

    it("should return a response if the file exists", async () => {
      (app as any).staticPath = "/public";
      mockFile.exists.mockResolvedValue(true);
      const result = await (app as any).resolveStaticFiles("/test.html");
      expect(result).not.toBeNull();
    });

    it("should handle files without type", async () => {
      (app as any).staticPath = "/public";
      mockFile.exists.mockResolvedValue(true);
      mockFile.type = undefined;
      const result = await (app as any).resolveStaticFiles("/test.bin");
      expect(result).not.toBeNull();
    });
  });

  describe("methodOverride", () => {
    it("should not override method if not a POST request", async () => {
      mockRequest.method = "GET";
      const method = await (app as any).methodOverride(mockRequest);
      expect(method).toBe("GET");
    });

    it("should not override method if content-type is not application/x-www-form-urlencoded", async () => {
      mockRequest.method = "POST";
      mockRequest.headers.set("content-type", "application/json");
      const method = await (app as any).methodOverride(mockRequest);
      expect(method).toBe("POST");
    });

    it("should override method if POST request with application/x-www-form-urlencoded", async () => {
      mockRequest.method = "POST";
      mockRequest.headers.set("content-type", "application/x-www-form-urlencoded");
      mockRequest.text = mock(() => Promise.resolve("_method=PUT"));
      const method = await (app as any).methodOverride(mockRequest);
      expect(method).toBe("PUT");
    });

    it("should not override method if _method is invalid", async () => {
      mockRequest.method = "POST";
      mockRequest.headers.set("content-type", "application/x-www-form-urlencoded");
      mockRequest.text = mock(() => Promise.resolve("_method=INVALID"));
      const method = await (app as any).methodOverride(mockRequest);
      expect(method).toBe("POST");
    });
  });

  describe("handleRequest", () => {
    it("should call resolveNotFound if no route is found and no static file", async () => {
      const resolveNotFoundSpy = spyOn(app as any, "resolveNotFound").mockImplementation(() => {});
      spyOn(app as any, "resolveStaticFiles").mockResolvedValue(false);
      await (app as any).handleRequest(mockRequest, mockServer);
      expect(resolveNotFoundSpy).toHaveBeenCalled();
      resolveNotFoundSpy.mockRestore();
    });
  });

  describe("setTemplateEngine", () => {
    it("should set the template engine", () => {
      const engine = { render: () => {} };
      (app as any).setTemplateEngine(engine);
      expect((app as any).templateEngine).toBe(engine);
    });
  });

  describe("getTemplateEngine", () => {
    it("should return the template engine", () => {
      const engine = { render: () => {} };
      (app as any).setTemplateEngine(engine);
      expect((app as any).getTemplateEngine()).toBe(engine);
    });

    it("should return null if no template engine is set", () => {
      expect((app as any).getTemplateEngine()).toBeNull();
    });
  });

  describe("engine alias", () => {
    it("should set and get the template engine via app.engine", () => {
      const engine: Engine = {
        render: () => Object.assign(Promise.resolve(""), { minify: async () => "" }),
        configure: () => {},
      };

      app.engine.set(engine);
      expect(app.engine.get()).toBe(engine);
    });
  });
});
