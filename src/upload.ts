import fs from "node:fs";
import path from "node:path";

import type { NextFunction, Request, Response } from "harpiats";
import type { CheckReturnObject, FileChecker, UploadConstructor } from "./types/upload";

export class Upload {
  private path: string;
  private fieldName: string;
  private prefix: string | undefined;
  private fileName: string | undefined;
  private options: FileChecker;

  constructor({ path, fieldName, prefix, fileName, options }: UploadConstructor = {}) {
    this.path = path || "uploads";
    this.fieldName = fieldName || "file";
    this.prefix = prefix;
    this.fileName = fileName;
    this.options = {
      maxSize: options?.maxSize ?? 5 * 1024 * 1024, // 5 MB in bytes
      allowedExtensions: options?.allowedExtensions || [],
      allowedTypes: options?.allowedTypes || [],
    };
  }

  private async saveFile(filePath: string, file: File) {
    await Bun.write(filePath, file);
  }

  public single = async (req: Request, res: Response, next: NextFunction) => {
    const formData = await req.formData();

    const file = formData.get(this.fieldName) as File;
    if (!file) return res.status(404).json({ message: "File Not Found" });

    const fileName = this.getFileName(file);
    const validationResult = this.fileChecker(this.options, file, fileName);
    if (validationResult) {
      req.formData = () => Promise.resolve(formData);
      return res.status(validationResult.status).json({ message: validationResult.message });
    }

    try {
      await this.saveFile(path.join(process.cwd(), this.path, fileName), file);
    } catch (_error) {
      return res.status(500).json({ message: "Internal server error" });
    }

    req.formData = () => Promise.resolve(formData);
    next();
  };

  public multiple = async (req: Request, res: Response, next: NextFunction) => {
    const formData = await req.formData();

    const files = formData.getAll(this.fieldName) as File[];
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "Files Not Found" });
    }

    const errors: { fileName: string; message: string }[] = [];
    const successfullyWrittenFiles: string[] = [];

    for (const file of files) {
      const fileName = this.getFileName(file);
      const validationResult = this.fileChecker(this.options, file, fileName);
      if (validationResult) {
        errors.push({ fileName: fileName, message: validationResult.message });
        continue;
      }

      try {
        const filePath = path.join(process.cwd(), this.path, fileName);

        try {
          await this.saveFile(filePath, file);
        } catch (_error) {
          return res.status(500).json({ message: "Internal server error" });
        }

        successfullyWrittenFiles.push(filePath);
      } catch (error: unknown) {
        errors.push({
          fileName: fileName,
          message: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    if (errors.length > 0) {
      for (const filePath of successfullyWrittenFiles) {
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          console.error(`Failed to delete file ${filePath}:`, error);
        }
      }

      return res.status(400).json({
        message: "Some files failed to process",
        errors,
      });
    }

    req.formData = () => Promise.resolve(formData);
    next();
  };

  private getFileName(file: File): string {
    const fileName = this.fileName
      ? `${this.prefix ? `${this.prefix}-` : ""}${this.fileName}${path.extname(file.name)}`
      : `${this.prefix ? `${this.prefix}-` : ""}${file.name}`;

    return fileName;
  }

  private fileChecker(options: FileChecker, file: File, fileName: string): CheckReturnObject {
    const maxSizeCheck = this.checkMaxSize(options, file, fileName);
    if (maxSizeCheck) return maxSizeCheck;

    const extensionsCheck = this.checkExtensions(options, fileName);
    if (extensionsCheck) return extensionsCheck;

    const typesCheck = this.checkTypes(options, file, fileName);
    if (typesCheck) return typesCheck;

    return null;
  }

  private checkMaxSize(options: FileChecker, file: File, fileName: string): CheckReturnObject {
    if (file.size > options.maxSize) {
      return {
        status: 400,
        message: `The file "${fileName}" exceeds the maximum allowed size of ${options.maxSize / 1024 / 1024} MB.`,
      };
    }

    return null;
  }

  private checkExtensions(options: FileChecker, fileName: string): CheckReturnObject {
    const fileExtension = path.extname(fileName).toLowerCase();
    if (options.allowedExtensions.length > 0 && !options.allowedExtensions.includes(fileExtension)) {
      return {
        status: 400,
        message: `The file "${fileName}" has a disallowed extension. Allowed extensions: ${options.allowedExtensions.join(", ")}.`,
      };
    }

    return null;
  }

  private checkTypes(options: FileChecker, file: File, fileName: string): CheckReturnObject {
    if (options.allowedTypes.length > 0 && !options.allowedTypes.includes(file.type)) {
      return {
        status: 400,
        message: `The file "${fileName}" has a disallowed type. Allowed types: ${options.allowedTypes.join(", ")}.`,
      };
    }

    return null;
  }
}
