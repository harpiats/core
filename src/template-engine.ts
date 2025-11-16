import fs, { readFile } from "node:fs/promises";
import path, { join } from "node:path";
import { colorize } from "./utils/colorize";

import type { Application } from "./server";
import type { Shield } from "./shield";
import type { Engine } from "./types/engine";
import type { Blocks, Data, Options, PluginFunction } from "./types/template-engine";

export class TemplateEngine implements Engine {
  private plugins: Record<string, PluginFunction> = {};
  private defaultViewName?: string;
  private viewsPath: string;
  private layoutsPath?: string;
  private componentsPath?: string;
  private useModules: boolean;
  private currentModule: string | null = null;
  private fileExtension: string;

  constructor(options: Options) {
    this.viewsPath = options.path.views;
    this.layoutsPath = options.path.layouts;
    this.componentsPath = options.path.components;
    this.defaultViewName = options.viewName;
    this.useModules = options.useModules ?? false;
    this.fileExtension = options.fileExtension ?? ".html";
    this.plugins = {
      raw: (str: any) => str,
    };
  }

  public configure(app: Application, shield?: Shield): void {
    app.engine.set(this);

    if (shield) {
      this.plugins["generateNonce"] = () => {
        const ip = app.requestIP() || "";
        return shield.getNonce(ip);
      };
    }
  }

  public module(moduleName: string): this {
    this.currentModule = moduleName;
    return this;
  }

  public async render(templateName: string, data: Data = {}): Promise<string> {
    let resolvedView = templateName;
    if (this.currentModule && !resolvedView.startsWith("*")) {
      resolvedView = `*${this.currentModule}*/${resolvedView}`;
    }

    const viewFilePath = await this.viewFilePathResolver(resolvedView);
    const processedContent = await this.processContent(viewFilePath, data);

    return this.minify(processedContent, "html");
  }

  public async generate(viewPath: string, data: Data = {}): Promise<string> {
    try {
      const viewFilePath = path.join(process.cwd(), `${viewPath}${this.fileExtension}`);
      const absolutePath = path.resolve(viewFilePath);

      try {
        await fs.access(absolutePath);
      } catch {
        throw new Error(`No files found: ${absolutePath}`);
      }

      return await this.processContent(absolutePath, data);
    } catch (error) {
      console.log(error);

      throw new Error("Error rendering template.");
    }
  }

  public registerPlugin(name: string, fn: PluginFunction): void {
    this.plugins[name] = fn;
  }

  public minify(text: string, type: "html" | "generic" = "generic"): string {
    if (type === "html") {
      return text
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/>\s+</g, "><")
        .replace(/\s+/g, " ")
        .replace(/\s+>/g, ">")
        .replace(/>\s+/g, ">")
        .trim();
    }

    return text
      .replace(/^\s*[\r\n]/gm, "")
      .replace(/[\r\n]{2,}/g, "\n")
      .replace(/^[ \t]+/gm, "")
      .replace(/[ \t]+$/gm, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1")
      .trim();
  }

  private async processContent(viewFilePath: string, data: Data): Promise<string> {
    let viewContent = await this.readFile(viewFilePath);

    // Process view fully
    viewContent = this.removeComments(viewContent);
    viewContent = this.processOperations(viewContent, data);
    viewContent = await this.processImport(viewContent, path.dirname(viewFilePath), data);

    if (this.componentsPath) {
      viewContent = await this.processComponents(viewContent, data);
    }

    // Extract blocks from view
    const extractedBlocks = await this.extractBlocks(viewContent);

    let blocks: Blocks = {};
    let remainingView = viewContent;

    if (extractedBlocks) {
      blocks = extractedBlocks.blocks;
      remainingView = extractedBlocks.content;

      if (remainingView.trim() && Object.keys(blocks).length === 0) {
        blocks.body = remainingView;
      }
    }

    if (!this.layoutsPath) {
      viewContent = this.interpolateVariables(viewContent, data);

      return viewContent;
    }

    // Load and fully process layout
    const layoutContentRaw = await this.processLayout(remainingView, data);
    const finalLayoutContent = await this.applyLayout(layoutContentRaw, blocks);

    return this.interpolateVariables(finalLayoutContent, data);
  }

  private async viewFilePathResolver(templateName: string): Promise<string> {
    if (this.useModules) {
      return await this.resolveViewPathWithModules(templateName);
    }

    return await this.resolveViewPath(templateName);
  }

  private async resolveViewPath(templateName: string): Promise<string> {
    const baseViewPath = this.viewsPath;
    const filePath = this.defaultViewName
      ? path.join(baseViewPath, templateName, `${this.defaultViewName}${this.fileExtension}`)
      : path.join(baseViewPath, `${templateName}${this.fileExtension}`);

    const absolutePath = path.resolve(filePath);

    if (!(await Bun.file(absolutePath).exists())) {
      throw new Error(`No files found: ${absolutePath}`);
    }

    return absolutePath;
  }

  private async resolveViewPathWithModules(templateName: string): Promise<string> {
    let moduleOverride: string | null = null;
    let viewName = templateName;

    const moduleRegex = /^\*([^*]+)\*\/(.*)$/;
    const match = templateName.match(moduleRegex);

    if (match) {
      moduleOverride = match[1];
      viewName = match[2];
    } else {
      moduleOverride = this.currentModule;
    }

    if (!moduleOverride) {
      throw new Error("View path must include a module.");
    }

    let effectiveViewsPath = this.viewsPath;
    if (this.viewsPath.includes("**") && moduleOverride) {
      effectiveViewsPath = this.viewsPath.replace("**", moduleOverride);
    }

    const filePath = this.defaultViewName
      ? path.join(effectiveViewsPath, viewName, `${this.defaultViewName}${this.fileExtension}`)
      : path.join(effectiveViewsPath, `${viewName}${this.fileExtension}`);

    const absolutePath = path.resolve(filePath);

    if (!(await Bun.file(absolutePath).exists())) {
      throw new Error(`No files found: ${absolutePath}`);
    }

    return absolutePath;
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf-8");
    } catch (error) {
      const message = colorize("#ff0000ff", `\nERROR: Unable to read file at ${filePath}\n`);

      if (process.env.NODE_ENV !== "test") {
        console.log(message);
      }

      throw new Error((error as Error).message);
    }
  }

  private async extractBlocks(content: string): Promise<{ blocks: Blocks; content: string } | undefined> {
    const layoutRegex = /@layout\s*\(["'](.+?)["'](?:,\s*(.+?))?\)/g;
    const isLayoutDefined = layoutRegex.test(content);

    if (isLayoutDefined) {
      const blocks: Blocks = {};
      const blockRegex = /@block\(["'](.+?)["']\)\s*([\s\S]*?)@endblock/g;

      const remainingContent = content.replace(blockRegex, (_, blockName, blockContent) => {
        // if (blockContent.length > 10000) {
        // 	throw new Error("Block content too large");
        // }

        blocks[blockName] = blockContent;
        return "";
      });

      return { blocks, content: remainingContent };
    }
  }

  private async applyLayout(layout: string, blocks: Blocks): Promise<string> {
    return layout.replace(/@yield\s*\(["'](.+?)["']\)/g, (_, blockName) => blocks[blockName] || "");
  }

  private async processLayout(content: string, data: Data): Promise<string> {
    if (!this.layoutsPath) throw new Error("Layout path is not defined.");

    const regex = /@layout\s*\(["'](.+?)["'](?:,\s*([\s\S]*?))?\)/g;
    const matches = [...content.matchAll(regex)];

    if (!matches.length) return content;

    for (const match of matches) {
      const layoutName = match[1];
      const params = match[2] ? this.evaluateExpression(match[2], data) : {};

      const layoutFilePath = path.join(this.layoutsPath!, `${layoutName}${this.fileExtension}`);
      const layoutContent = await this.readFile(layoutFilePath);
      const processedLayout = await this.processIsolatedContent(
        layoutContent,
        { ...data, ...params },
        this.layoutsPath,
      );

      content = content.replace(match[0], processedLayout);
    }

    return content;
  }

  private async processComponents(content: string, data: Data): Promise<string> {
    if (!this.componentsPath) throw new Error("Component path is not defined.");

    const componentRegex = /@component\(["'](.+?)["'](?:,\s*([\s\S]*?))?\)/gs;
    const matches = [...content.matchAll(componentRegex)];

    for (const match of matches) {
      const componentName = match[1];
      const componentParams = match[2] ? this.evaluateExpression(match[2], data) : {};

      const componentContent = await this.readFile(join(this.componentsPath, `${componentName}${this.fileExtension}`));
      const processedComponent = await this.processIsolatedContent(
        componentContent,
        { ...data, ...componentParams },
        this.componentsPath,
      );

      content = content.replace(match[0], processedComponent);
    }

    return content;
  }

  private async processImport(content: string, currentDir: string, data: Data): Promise<string> {
    const regex = /@import\(["'](.+?)["'](?:,\s*([\s\S]*?))?\)/gs;
    const matches = [...content.matchAll(regex)];

    for (const match of matches) {
      const importPath = match[1];
      const importParams = match[2] ? this.evaluateExpression(match[2], data) : {};

      const fullPath = join(currentDir, `${importPath}${this.fileExtension}`);
      const importContent = await this.readFile(fullPath);
      const renderedInclude = await this.processIsolatedContent(
        importContent,
        { ...data, ...importParams },
        path.dirname(fullPath),
      );

      content = content.replace(match[0], renderedInclude);
    }

    return content;
  }

  private async processIsolatedContent(content: string, data: Data, baseDir: string): Promise<string> {
    content = this.removeComments(content);
    content = this.processOperations(content, data);
    content = await this.processImport(content, baseDir, data);

    if (this.componentsPath) {
      content = await this.processComponents(content, data);
    }

    content = this.interpolateVariables(content, data);

    return content;
  }

  private processOperations(content: string, data: Data): string {
    content = this.extractVariables(content, data);
    content = this.processLoops(content, data);
    content = this.processConditionals(content, data);

    return content;
  }

  private extractVariables(content: string, data: Data): string {
    const blockRegex = /@set\s+(\w+)\s*=\s*([\s\S]*?)@endset/g;

    content = content.replace(blockRegex, (_, varName, blockContent) => {
      try {
        data[varName] = this.evaluateExpression(blockContent.trim(), data);
      } catch (error) {
        console.error(`Error evaluating block expression: ${blockContent}`, error);
        data[varName] = "";
      }
      return "";
    });

    return content;
  }

  private processConditionals(content: string, data: Data): string {
    const conditionalRegex = /@if\s+([^\n@]+)([\s\S]*?)@endif/g;

    return content.replace(conditionalRegex, (_match, condition, blocks) => {
      // Split the blocks into if, elseif, and else parts
      const blockParts = blocks.split(/(?=@else(?:if[^\n@]+)?)/);

      let ifBlock = "";
      let elseBlock = "";
      const elseifBlocks: Array<{ condition: string; content: string }> = [];

      // Parse all blocks
      for (const part of blockParts) {
        if (part.startsWith("@elseif")) {
          const elseifMatch = part.match(/@elseif\s+([^\n@]+)([\s\S]*)/);
          if (elseifMatch) {
            elseifBlocks.push({
              condition: elseifMatch[1],
              content: elseifMatch[2],
            });
          }
        } else if (part.startsWith("@else")) {
          elseBlock = part.replace(/@else\s*/, "");
        } else {
          ifBlock = part;
        }
      }

      // Check main condition
      let pluginResult = this.callPlugin(condition, data);
      if (pluginResult !== undefined && pluginResult !== null) {
        if (pluginResult) return this.processConditionals(ifBlock, data);
      } else if (this.evaluateExpression(condition, data)) {
        return this.processConditionals(ifBlock, data);
      }

      // Check elseif conditions
      for (const elseif of elseifBlocks) {
        pluginResult = this.callPlugin(elseif.condition, data);
        if (pluginResult !== undefined && pluginResult !== null) {
          if (pluginResult) return this.processConditionals(elseif.content, data);
        } else if (this.evaluateExpression(elseif.condition, data)) {
          return this.processConditionals(elseif.content, data);
        }
      }

      // Return else block
      return elseBlock ? this.processConditionals(elseBlock, data) : "";
    });
  }

  private processLoops(content: string, data: Data): string {
    const loopRegex = /@for\s+(?:\[(\w+),\s*(\w+)\]|(\w+))\s+in\s+(.+?)\n([\s\S]*?)@endfor/g;

    return content.replace(loopRegex, (_match, keyName, valueName, itemName, listName, blockContent) => {
      const list = this.evaluateExpression(listName, data) || [];

      if (keyName && valueName) {
        // Object iteration - [key, value] in object
        return Object.entries(list)
          .map(([key, value]) =>
            this.processBlockContent(blockContent.trim(), { ...data, [keyName]: key, [valueName]: value }),
          )
          .join("");
      } else {
        // Array iteration - item in array
        return list
          .map((item: any) => this.processBlockContent(blockContent.trim(), { ...data, [itemName]: item }))
          .join("");
      }
    });
  }

  private processBlockContent(content: string, data: Data): string {
    let processedContent = content;

    processedContent = this.extractVariables(processedContent, data);
    processedContent = this.processLoops(processedContent, data);
    processedContent = this.processConditionals(processedContent, data);
    processedContent = this.interpolateVariables(processedContent, data);

    return processedContent;
  }

  private interpolateVariables(content: string, data: Data): string {
    content = this.checkAndWarn(content);

    content = content.replace(/{{\s*raw\(([\s\S]*?)\)\s*}}/gs, (_, innerExpression) => {
      return this.processExpression(innerExpression, data, false);
    });

    content = content.replace(/{{(?![{])[\s]*(.+?)[\s]*}}/gs, (_, expression) => {
      return this.processExpression(expression, data, true);
    });

    return content;
  }

  private checkAndWarn(content: string) {
    content = content.replace(/@layout\s*\(["'](.+?)["'](?:,\s*(.+?))?\)/g, () => {
      if (!this.layoutsPath) {
        const message = colorize("#FFA500", "WARNING: You're trying to use a layout, but layout path is not defined.");

        console.log(message);
      }

      return "";
    });

    content = content.replace(/@block\(["'](.+?)["']\)\s*([\s\S]*?)@endblock/g, (string) => {
      if (!this.layoutsPath) {
        const message = colorize(
          "#FFA500",
          "WARNING: You're trying to use a layout block, but layout path is not defined.",
        );

        console.log(message);
      }

      return string.replace(/@block\(["'][^"']+["']\)/g, "").replace(/@endblock/g, "");
    });

    content = content.replace(/@component\(["'](.+?)["'](?:,\s*(.+?))?\)/g, (match) => {
      if (!this.componentsPath) {
        const message = colorize(
          "#FFA500",
          "WARNING: You're trying to use a component, but components path is not defined.",
        );

        console.log(message);
        return "";
      }

      return match;
    });

    return content;
  }

  private processExpression(expression: string, data: Data, shouldEscape: boolean): string {
    expression = expression.trim();

    // 1. Check variable
    const variableValue = this.resolveVariable(expression, data);
    if (variableValue !== undefined && variableValue !== null) {
      return shouldEscape ? this.escapeHtml(variableValue) : variableValue;
    }

    // 2. Check plugin
    const pluginResult = this.callPlugin(expression, data);
    if (pluginResult !== undefined && pluginResult !== null) {
      return shouldEscape ? this.escapeHtml(pluginResult) : pluginResult;
    }

    // 3. Evaluates JS expression
    try {
      const evaluated = this.evaluateExpression(expression, data);
      if (evaluated !== undefined && evaluated !== null) {
        return shouldEscape ? this.escapeHtml(evaluated) : evaluated;
      }
    } catch (error) {
      console.log(colorize("#FFA500", `[Template Engine] Expression evaluation failed: "${expression}"`));
      console.log(colorize("#ff0000ff", `[Template Engine] Error: ${error instanceof Error ? error.message : error}`));

      return "";
    }

    return "";
  }

  private resolveVariable(varName: string, data: Data): any {
    return varName.split(".").reduce((acc, key) => acc?.[key], data);
  }

  private evaluateExpression(expression: string, data: Data): any {
    // Check if expression is a plugin call
    const pluginMatch = expression.match(/^(\w+)\(/);
    if (pluginMatch) {
      const pluginName = pluginMatch[1];
      if (!this.plugins[pluginName]) {
        return null;
      }

      try {
        const pluginResult = this.callPlugin(expression, data);
        if (pluginResult !== undefined && pluginResult !== null) {
          return pluginResult;
        }
      } catch (error: any) {
        console.warn(`Plugin ${pluginName} execution warning:`, error.message);
        return null;
      }
    }

    // Fallback to JavaScript evaluation
    try {
      const func = new Function(...Object.keys(data), `return ${expression};`);
      return func(...Object.values(data));
    } catch (error: any) {
      console.warn(`Expression evaluation warning: ${error.message}`);
      return null;
    }
  }

  private callPlugin(expression: string, data: Data): string | null {
    const match = expression.match(/^(\w+)\((.*)\)$/);
    if (!match) return null;

    const [_, pluginName, argsString] = match;
    const args = this.parseArguments(argsString, data);

    if (this.plugins[pluginName]) {
      try {
        return this.plugins[pluginName](...args);
      } catch (error) {
        console.error(`Error calling plugin ${pluginName}:`, error);
        return null;
      }
    }

    return null;
  }

  private parseArguments(argsString: string, data: Data): any[] {
    const args: any[] = [];
    let currentArg = "";
    let depth = 0; // Tracks () nesting
    let arrayDepth = 0; // Tracks [] nesting
    let objectDepth = 0; // Tracks {} nesting
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      // Handle string literals (including escaped quotes)
      if (inString) {
        currentArg += char;
        if (char === stringChar && (i === 0 || argsString[i - 1] !== "\\")) {
          inString = false;
        }
        continue;
      }

      // Detect string start
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        currentArg += char;
        continue;
      }

      // Update nesting levels
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "[") arrayDepth++;
      if (char === "]") arrayDepth--;
      if (char === "{") objectDepth++;
      if (char === "}") objectDepth--;

      // Only treat comma as separator at root level
      if (char === "," && depth === 0 && arrayDepth === 0 && objectDepth === 0) {
        args.push(this.processArgument(currentArg.trim(), data));
        currentArg = "";
        continue;
      }

      currentArg += char;
    }

    // Relaxed validation for conditional expressions
    const isConditionalExpression = argsString.includes(")") && !argsString.trim().endsWith(")") && depth > 0;

    if ((!isConditionalExpression && depth !== 0) || arrayDepth !== 0 || objectDepth !== 0) {
      throw new Error("Malformed arguments: Unbalanced brackets/braces/parentheses");
    }

    // Add final argument
    if (currentArg.trim()) {
      args.push(this.processArgument(currentArg.trim(), data));
    }

    return args;
  }

  private processArgument(arg: string, data: Data): any {
    // Handle string literals (including escaped characters)
    if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
      return arg.slice(1, -1).replace(/\\(.)/g, "$1");
    }

    // Handle numbers (more precise validation)
    if (/^-?\d+\.?\d*$/.test(arg.trim())) {
      return Number(arg);
    }

    // Handle booleans
    if (arg === "true") return true;
    if (arg === "false") return false;

    // Handle JSON arrays and objects
    if ((arg.startsWith("[") && arg.endsWith("]")) || (arg.startsWith("{") && arg.endsWith("}"))) {
      try {
        return JSON.parse(arg);
      } catch {
        return arg; // Fallback to string if invalid JSON
      }
    }

    // Check for variables in data context
    const variableValue = this.resolveVariable(arg, data);
    if (variableValue !== undefined) {
      return variableValue;
    }

    // Handle plugin calls (improved regex)
    if (/^[a-zA-Z_]\w*\s*\([\s\S]*\)$/.test(arg)) {
      return this.callPlugin(arg, data);
    }

    // Default string return
    return arg;
  }

  private removeComments(content: string): string {
    return content.replace(/##.*$/gm, "");
  }

  private escapeHtml(unsafe: any): string {
    if (unsafe == null) return "";

    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/`/g, "&#96;")
      .replace(/=/g, "&#61;")
      .replace(/\//g, "&#47;");
  }
}
