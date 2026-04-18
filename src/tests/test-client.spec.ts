import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Application } from "../server";
import { TestClient } from "../test-client";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";

const TEST_DIR = join(os.tmpdir(), "harpia-test-client");

const mockProcessRequest = mock(async () => ({
  status: 200,
  json: async () => ({}),
  text: async () => "",
}));

const mockApp = {
  server: () => ({
    hostname: "localhost",
    port: 3000,
  }),
  processRequest: mockProcessRequest,
} as unknown as Application;

describe("TestClient", () => {
  let client: TestClient;
  const validPath = join(TEST_DIR, "valid-file.txt");

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(validPath, "content");
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    client = new TestClient(mockApp);
  });

  afterEach(() => {
    mockProcessRequest.mockClear();
  });

  describe("HTTP Methods", () => {
    const methods: Array<{ method: keyof TestClient; verb: string }> = [
      { method: "get", verb: "GET" },
      { method: "post", verb: "POST" },
      { method: "put", verb: "PUT" },
      { method: "delete", verb: "DELETE" },
      { method: "patch", verb: "PATCH" },
      { method: "options", verb: "OPTIONS" },
      { method: "head", verb: "HEAD" },
    ];

    for (const { method, verb } of methods) {
      test(`should set ${verb} method`, () => {
        (client as any)[method]("/test");
        expect(client["method"]).toBe(verb);
        expect(client["url"]).toBe("/test");
      });
    }
  });

  describe("Headers", () => {
    test("should set headers", () => {
      client.set("Authorization", "Bearer token");
      expect(client["headersInstance"].get("Authorization")).toBe("Bearer token");
    });
  });

  describe("Query Parameters", () => {
    test("should add query params", () => {
      client.get("/search").query("q", "test");
      expect(client["url"]).toBe("/search?q=test");
    });

    test("should handle multiple query params", () => {
      client.get("/search").query("q", "test").query("page", "2");
      expect(client["url"]).toBe("/search?q=test&page=2");
    });

    test("should handle existing query params in URL", () => {
      client.get("/search?category=books").query("q", "test");
      expect(client["url"]).toBe("/search?category=books&q=test");
    });

    test("should encode special characters in query params", () => {
      client.get("/search").query("q", "test espaço&");

      expect(client["url"]).toBe("/search?q=test+espa%C3%A7o%26");
    });
  });

  describe("Request Body", () => {
    test("should handle raw data with send()", () => {
      client.post("/raw").send("plain text");
      expect(client["body"]).toBe("plain text");
      expect(client["headersInstance"].get("Content-Length")).toBe("10");
    });

    test("should send JSON data", () => {
      client.post("/data").json({ key: "value" });
      expect(client["body"]).toEqual({ key: "value" });
      expect(client["headersInstance"].get("Content-Type")).toBe("application/json");
    });

    test("should send FormData", () => {
      const form = { name: "John" };
      client.post("/form").formData(form);
      expect(client["body"]).toBeInstanceOf(FormData);
    });

    test("should handle mixed form data types", () => {
      const file = new Blob(["content"], { type: "text/plain" });
      client.post("/upload").formData({ name: "John" }).file({ avatar: file });
      expect(client["body"].get("name")).toBe("John");
      expect(client["body"].get("avatar")).toBeInstanceOf(Blob);
    });

    test("should throw error when mixing body types", () => {
      client.json({});
      expect(() => client.formData({})).toThrow("Cannot use formData() after json().");
    });

    test("should handle mixed FormData types (string + Blob)", () => {
      const file = new Blob(["content"], { type: "text/plain" });
      client.post("/upload").formData({
        name: "John",
        avatar: file,
      });

      const body = client["body"] as FormData;
      expect(body.get("name")).toBe("John");
      expect(body.get("avatar")).toBeInstanceOf(Blob);
    });

    test("should handle filenames with special characters", () => {
      const file = new Blob([], { type: "image/jpeg" });
      client.file({
        "foto@1.jpg": file,
      });
      expect(client["body"].has("foto@1.jpg")).toBe(true);
    });
  });

  describe("File Uploads", () => {
    const mockBlob = new Blob(["content"], { type: "text/plain" });

    test("should handle single file upload", () => {
      client.post("/upload").file({ file: new globalThis.Blob(["content"], { type: "text/plain" }) });
      expect(client["body"]).toBeInstanceOf(FormData);
    });

    test("should handle single file upload with valid path", () => {
      client.post("/upload").file({ file: validPath });
      expect(client["body"]).toBeInstanceOf(FormData);
    });

    test("should handle multiple files", () => {
      client.post("/upload").files({ docs: [mockBlob, mockBlob] });
      expect(client["body"]).toBeInstanceOf(FormData);
    });

    test("should handle multiple files with valid path", () => {
      client.post("/upload").files({ docs: [validPath, mockBlob] });
      expect(client["body"]).toBeInstanceOf(FormData);
    });

    test("should throw error for invalid file type in files()", () => {
      expect(() => client.files({ docs: [123 as unknown as Blob] })).toThrow('Invalid file type for key "docs"');
    });

    test("should throw error for invalid file type in file()", () => {
      expect(() => client.file({ file: 123 as unknown as Blob })).toThrow('Invalid file type for key "file"');
    });

    test("should preserve file MIME type", () => {
      const file = new Blob([], { type: "image/png" });
      client.file({ image: file });
      expect(client["body"].get("image").type).toBe("image/png");
    });
  });

  describe("Request Execution", () => {
    test("should create correct request", async () => {
      await client.post("/test").json({ data: "value" }).execute();

      const request = (mockApp.processRequest as any).mock.calls[0][0];
      expect(request.url).toMatch(/\/test$/);
      expect(request.method).toBe("POST");
    });

    test("should return response", async () => {
      const response = await client.get("/").execute();
      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    test("should prevent mixed content types", () => {
      client.formData({});
      expect(() => client.json({})).toThrow("Cannot use json() after formData()");
    });

    test("should validate file existence in files()", async () => {
      expect(() => client.files({ docs: ["/invalid/path"] })).toThrow("File not found at path: /invalid/path");
    });

    test("should validate file existence", async () => {
      expect(() => client.file({ file: "/invalid/path" })).toThrow("File not found at path: /invalid/path");
    });
  });

  describe("Content-Length", () => {
    test("should auto-set Content-Length for string bodies", () => {
      client.post("/").send("data");
      expect(client["headersInstance"].get("Content-Length")).toBe("4");
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty FormData", () => {
      client.post("/empty").formData({});
      expect(client["body"].toString()).toBe("[object FormData]");
    });

    test("should handle multiple files with same key", () => {
      const file = new Blob(["content"]);
      client.post("/upload").files({ docs: [file, file] });
      expect(client["body"].getAll("docs").length).toBe(2);
    });
  });
});
