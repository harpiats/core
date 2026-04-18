import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Response } from "../response";
import harpia from "../../index";
import type { TemplateEngine } from "../template-engine";

describe("Response", () => {
  let response: Response;

  beforeEach(() => {
    response = new Response();
  });

  it("should set status code", () => {
    response.status(404);
    const parsedResponse = response.parse();
    expect(parsedResponse.status).toBe(404);
  });

  it("should set body and content-length header with send", async () => {
    response.send("Hello, world!");
    const parsedResponse = response.parse();
    expect(await parsedResponse.text()).toBe("Hello, world!");
    expect(parsedResponse.headers.get("Content-Length")).toBe("13");
  });

  it("should set body and content-type header with html", async () => {
    response.html("<h1>Hello</h1>");
    const parsedResponse = response.parse();
    expect(await parsedResponse.text()).toBe("<h1>Hello</h1>");
    expect(parsedResponse.headers.get("Content-Type")).toBe("text/html");
  });

  it("should set body and content-type header with json", async () => {
    response.json({ message: "Hello" });
    const parsedResponse = response.parse();
    expect(await parsedResponse.json()).toEqual({ message: "Hello" });
    expect(parsedResponse.headers.get("Content-Type")).toBe("application/json");
  });

  it("should set location header and status code with redirect", async () => {
    response.redirect("/new-location");
    const parsedResponse = response.parse();
    expect(parsedResponse.status).toBe(302);
    expect(parsedResponse.headers.get("Location")).toBe("/new-location");
    expect(await parsedResponse.text()).toBe("Redirecting to /new-location");
  });

  it("should set custom status code with redirect", () => {
    response.redirect("/new-location", 301);
    const parsedResponse = response.parse();
    expect(parsedResponse.status).toBe(301);
    expect(parsedResponse.headers.get("Location")).toBe("/new-location");
  });

  it("should set cookie", () => {
    response.cookies.set("name", "value");
    const parsedResponse = response.parse();

    expect(parsedResponse.headers.get("Set-Cookie")).toBe("name=value");
  });

  it("should delete a cookie", () => {
    response.cookies.delete("name");
    const parsedResponse = response.parse();
    const cookie = parsedResponse.headers.get("Set-Cookie");
    expect(cookie).toContain("name=;");
    expect(cookie).toContain("Max-Age=0");
  });

  it("should delete a cookie with options", () => {
    response.cookies.delete("name", { domain: "example.com" });
    const parsedResponse = response.parse();
    const cookie = parsedResponse.headers.get("Set-Cookie");
    expect(cookie).toContain("name=;");
    expect(cookie).toContain("Domain=example.com");
  });

  it("should set multiple cookies", () => {
    response.cookies.set("name1", "value1");
    response.cookies.set("name2", "value2");
    const parsedResponse = response.parse();

    const cookies = parsedResponse.headers.getSetCookie();

    expect(cookies).toContain("name1=value1");
    expect(cookies).toContain("name2=value2");
  });

  it("should set module name", () => {
    response.module("users");
    expect((response as any).currentModule).toBe("users");
  });

  it("should render template", async () => {
    const mockRender = mock(() => {
      const promise = Promise.resolve("<h1>Rendered</h1>") as any;
      promise.minify = mock(() => Promise.resolve("<h1>Rendered</h1>"));
      return promise;
    });

    const mockEngine = { render: mockRender };
    const app = harpia();
    app.engine.set(mockEngine as unknown as TemplateEngine);
    response = new Response(app);

    await response.render("index", { title: "Test" });
    const parsedResponse = response.parse();

    expect(mockRender).toHaveBeenCalledWith("index", { title: "Test" });
    expect(parsedResponse.headers.get("Content-Type")).toBe("text/html");

    // Ler o conteúdo do ReadableStream
    const bodyText = await parsedResponse.text();
    expect(bodyText).toBe("<h1>Rendered</h1>");
  });

  it("should render template with module", async () => {
    const mockRender = mock(() => {
      const promise = Promise.resolve("<h1>Rendered</h1>") as any;
      promise.minify = mock(() => Promise.resolve("<h1>Rendered</h1>"));
      return promise;
    });

    const mockEngine = { render: mockRender };
    const app = harpia();
    app.engine.set(mockEngine as unknown as TemplateEngine);
    response = new Response(app);

    response.module("users");
    await response.render("index", { title: "Test" });
    const parsedResponse = response.parse();

    expect(mockRender).toHaveBeenCalledWith("*users*/index", { title: "Test" });
    expect(parsedResponse.headers.get("Content-Type")).toBe("text/html");
    expect(await parsedResponse.text()).toBe("<h1>Rendered</h1>");
  });

  it("should throw error if no template engine is configured", async () => {
    const app = harpia();
    response = new Response(app);
    app.engine.set(null as unknown as TemplateEngine);

    expect(response.render("index", { title: "Test" })).rejects.toThrow("No template engine configured.");
  });

  it("should throw error if template rendering fails", async () => {
    const mockRender = mock(() => {
      return {
        minify: mock(() => Promise.reject(new Error("Rendering failed"))),
      };
    });

    const mockEngine = { render: mockRender };
    const app = harpia();
    app.engine.set(mockEngine as unknown as TemplateEngine);
    response = new Response(app);

    expect(response.render("index", { title: "Test" })).rejects.toThrow("Rendering failed");
  });

  it("should set cookie with options", () => {
    response.cookies.set("name", "value", { httpOnly: true, maxAge: 3600 });
    const parsedResponse = response.parse();

    expect(parsedResponse.headers.get("Set-Cookie")).toContain("name=value");
    expect(parsedResponse.headers.get("Set-Cookie")).toContain("HTTPOnly");
    expect(parsedResponse.headers.get("Set-Cookie")).toContain("Max-Age=3600");
  });

  it("should set cookies in headers", () => {
    response.cookies.set("name1", "value1");
    response.cookies.set("name2", "value2");
    response.send("test");
    const parsedResponse = response.parse();
    const cookies = parsedResponse.headers.getAll("Set-Cookie");

    expect(cookies).toBeArray();
    expect(cookies).toEqual(expect.arrayContaining(["name1=value1", "name2=value2"]));
  });
});
