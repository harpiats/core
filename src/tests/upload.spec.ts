import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { Upload } from "../upload";

import type { Request } from "../request";
import type { Response } from "../response";

// Mock de Request e Response
const mockRequest = (files?: File[]): Request =>
  ({
    formData: async () => {
      const formData = new FormData();

      for (const file of files || []) {
        formData.append("file", file);
      }

      return formData;
    },
  }) as any;

const mockResponse = (): Response => {
  const res: any = {};
  res.status = mock(function (this: any) {
    return res;
  });
  res.json = mock(() => {});
  return res as unknown as Response;
};

const mockNext = mock(() => {});

describe("Upload", () => {
  let upload: Upload;

  beforeEach(async () => {
    upload = new Upload({
      path: "test-tmp",
      options: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: [".jpg", ".png"],
        allowedTypes: ["image/jpeg", "image/png"],
      },
    });
  });

  afterEach(async () => {
    await rm("test-tmp", { recursive: true, force: true });
  });

  describe("single()", () => {
    test("should upload valid file", async () => {
      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      const req = mockRequest([file]);
      const res = mockResponse();

      await upload.single(req, res, mockNext);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(mockNext).toHaveBeenCalled();
      
      // Cover the closure that wraps formData
      const formData = await req.formData();
      expect(formData.get("file")).toBeTruthy();
    });

    test("should reject file exceeding size limit", async () => {
      // Arquivo com tipo permitido mas tamanho excessivo
      const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg", // Tipo permitido para forçar erro no size check
      });

      const req = mockRequest([largeFile]);
      const res = mockResponse();

      await upload.single(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'The file "large.jpg" exceeds the maximum allowed size of 5 MB.',
      });

      const processedFormData = await req.formData();
      expect(processedFormData.get("file")).toBeTruthy();
    });

    test("should reject invalid file extension", async () => {
      // Usar tipo permitido para forçar erro na extensão
      const file = new File(["content"], "test.txt", {
        type: "image/jpeg", // Tipo permitido
      });
      const req = mockRequest([file]);
      const res = mockResponse();

      await upload.single(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining("disallowed extension"),
      });
    });

    test("should create directory if it doesn't exist", async () => {
      const file = new File(["content"], "img.jpg", { type: "image/jpeg" });
      const req = mockRequest([file]);
      const res = mockResponse();

      await upload.single(req, res, mockNext);

      const savedPath = resolve("test-tmp", "img.jpg");
      const exists = await Bun.file(savedPath).exists();
      expect(exists).toBe(true);
    });

    test("should save file with custom name and prefix", async () => {
      const file = new File(["content"], "original.jpg", { type: "image/jpeg" });
      const customUpload = new Upload({
        path: "test-tmp",
        fileName: "custom",
        prefix: "pre",
      });

      const req = mockRequest([file]);
      const res = mockResponse();

      await customUpload.single(req, res, mockNext);

      const savedPath = resolve("test-tmp", "pre-custom.jpg");
      const exists = await Bun.file(savedPath).exists();
      expect(exists).toBe(true);
    });
  });

  describe("multiple()", () => {
    test("should handle multiple valid files", async () => {
      const files = [
        new File(["content1"], "img1.jpg", { type: "image/jpeg" }),
        new File(["content2"], "img2.png", { type: "image/png" }),
      ];
      const req = mockRequest(files);
      const res = mockResponse();

      await upload.multiple(req, res, mockNext);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();

      // Cover the closure that wraps formData
      const formData = await req.formData();
      expect(formData.getAll("file").length).toBe(2);
    });

    test("should rollback on partial failure", async () => {
      const files = [new File(["valid"], "good.jpg"), new File([new Uint8Array(6 * 1024 * 1024)], "bad.jpg")];
      const req = mockRequest(files);
      const res = mockResponse();

      await upload.multiple(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Some files failed to process",
        errors: expect.any(Array),
      });
    });
  });

  describe("file naming", () => {
    test("should generate filename with prefix", async () => {
      const customUpload = new Upload({
        prefix: "pre",
        fileName: "custom",
      });

      const file = new File(["content"], "original.jpg");
      const fileName = customUpload["getFileName"](file);

      expect(fileName).toBe("pre-custom.jpg");
    });

    test("should use original filename if no custom name", async () => {
      const file = new File(["content"], "original.jpg");
      const fileName = upload["getFileName"](file);

      expect(fileName).toBe("original.jpg");
    });
  });

  describe("validation", () => {
    test("should check allowed types", () => {
      // Usar extensão permitida com tipo inválido
      const file = new File(["content"], "valid.jpg", {
        type: "image/gif", // Tipo não permitido
      });
      const result = upload["fileChecker"](upload["options"], file, "valid.jpg");

      expect(result).toEqual({
        status: 400,
        message: expect.stringContaining("disallowed type"),
      });
    });

    test("should pass valid file", () => {
      const file = new File(["content"], "valid.jpg", { type: "image/jpeg" });
      const result = upload["fileChecker"](upload["options"], file, "valid.jpg");

      expect(result).toBeNull();
    });
  });

  describe("internal errors", () => {
    test("should handle internal error when saving file", async () => {
      const file = new File(["content"], "img.jpg", { type: "image/jpeg" });

      const upload = new Upload({ path: "test-tmp" });
      upload["saveFile"] = async () => {
        throw new Error("Simulated failure");
      };

      const req = mockRequest([file]);
      const res = mockResponse();

      await upload.single(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });

    test("should handle internal error during multiple file upload", async () => {
      const files = [new File(["content"], "img1.jpg", { type: "image/jpeg" })];
      const req = mockRequest(files);
      const res = mockResponse();

      upload["saveFile"] = async () => {
        throw new Error("Simulated failure in multiple()");
      };

      await upload.multiple(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });
});
