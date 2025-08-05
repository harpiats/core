import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Application } from "src/server";
import { TemplateEngine } from "../template-engine";
import type { Options } from "../types/template-engine";

type TestEngineOptions = Omit<Partial<Options>, "path"> & {
  path?: Partial<Options["path"]>;
};

const TEST_DIR = resolve(process.cwd(), "test-temp");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  await mkdir(join(TEST_DIR, "views"), { recursive: true });
  await mkdir(join(TEST_DIR, "views/includes"), { recursive: true });
  await mkdir(join(TEST_DIR, "views/admin"), { recursive: true });
  await mkdir(join(TEST_DIR, "layouts"), { recursive: true });
  await mkdir(join(TEST_DIR, "partials"), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

function createTestEngine(options: TestEngineOptions = {}) {
  const baseOptions: Options = {
    path: {
      views: join(TEST_DIR, "views"),
      layouts: join(TEST_DIR, "layouts"),
      partials: join(TEST_DIR, "partials"),
      ...options.path,
    },
    fileExtension: options.fileExtension ?? ".html",
    useModules: options.useModules ?? false,
    viewName: options.viewName ?? undefined,
  };

  return new TemplateEngine(baseOptions);
}

async function createTestFile(path: string, content: string) {
  await writeFile(resolve(TEST_DIR, path), content, "utf-8");
}

describe("TemplateEngine", () => {
  test("should initialize with default settings", () => {
    const engine = createTestEngine();
    expect(engine).toBeInstanceOf(TemplateEngine);
  });

  describe("Basic Rendering", () => {
    test("should interpolate variables", async () => {
      await createTestFile("views/index.html", "Hello {{ name }}!");
      const engine = createTestEngine();
      const result = await engine.render("index", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    test("should escape HTML by default", async () => {
      await createTestFile("views/index.html", "{{ unsafe }}");
      const engine = createTestEngine();
      const result = await engine.render("index", { unsafe: "<script>" });
      expect(result).toBe("&lt;script&gt;");
    });

    test("should allow unescaped HTML", async () => {
      await createTestFile("views/index.html", "{{{ safe }}}");
      const engine = createTestEngine();
      const result = await engine.render("index", { safe: "<div>" });
      expect(result).toBe("<div>");
    });
  });

  describe("Layouts and Blocks", () => {
    beforeEach(async () => {
      await createTestFile(
        "layouts/base.html",
        `
        <html>{{= define block('content') }}</html>
      `,
      );
      await createTestFile(
        "views/page.html",
        `
        {{= layout('base') }}
        {{= block('content') }}Hello{{= endblock }}
      `,
      );
    });

    test("should apply layout correctly", async () => {
      const engine = createTestEngine();
      const result = await engine.render("page");
      expect(result).toMatch(/<html>Hello<\/html>/);
    });
  });

  describe("Partials and Includes", () => {
    test("should include partials", async () => {
      await createTestFile("partials/header.html", "<header>Partial</header>");
      await createTestFile("views/page.html", "{{= partial('header') }}");

      const engine = createTestEngine();
      const result = await engine.render("page");
      expect(result).toContain("<header>Partial</header>");
    });

    test("should process includes", async () => {
      await createTestFile("views/includes/footer.html", "<footer>Footer</footer>");
      await createTestFile("views/page.html", "{{= include('includes/footer') }}");

      const engine = createTestEngine();
      const result = await engine.render("page");
      expect(result).toContain("<footer>Footer</footer>");
    });
  });

  describe("Control Logic", () => {
    test("should process conditionals", async () => {
      await createTestFile(
        "views/conditional.html",
        `
        {{~ if (show) }}Yes{{~ else }}No{{~ endif }}
      `,
      );

      const engine = createTestEngine();
      const trueResult = await engine.render("conditional", { show: true });
      const falseResult = await engine.render("conditional", { show: false });
      expect(trueResult).toContain("Yes");
      expect(falseResult).toContain("No");
    });

    test("should process loops", async () => {
      await createTestFile(
        "views/loop.html",
        `
        {{~ for item in items }}<li>{{ item }}</li>{{~ endfor }}
      `,
      );

      const engine = createTestEngine();
      const result = await engine.render("loop", { items: ["A", "B"] });
      expect(result).toContain("<li>A</li><li>B</li>");
    });
  });

  describe("Conditionals with Plugins", () => {
    test("should work with plugins in conditions", async () => {
      await createTestFile(
        "views/condition-plugin.html",
        "{{~ if (equals(name, 'John')) }}<p>Hello John</p>{{~ else }}<p>Hello stranger</p>{{~ endif }}",
      );
      const engine = createTestEngine();
      engine.registerPlugin("equals", (a: string, b: string) => a === b);
      const result = await engine.render("condition-plugin", { name: "John" });
      expect(result).toBe("<p>Hello John</p>");
    });

    test("should work with complex conditions with plugins", async () => {
      await createTestFile(
        "views/condition-complex.html",
        "{{~ if (and(equals(name, 'John'), greaterThan(age, 25))) }}<p>Hello John, over 25</p>{{~ else }}<p>Hello stranger</p>{{~ endif }}",
      );
      const engine = createTestEngine();
      engine.registerPlugin("equals", (a: any, b: any) => a === b);
      engine.registerPlugin("greaterThan", (a: number, b: number) => a > b);
      engine.registerPlugin("and", (...args: boolean[]) => args.every(Boolean));
      const result = await engine.render("condition-complex", { name: "John", age: 30 });
      expect(result).toBe("<p>Hello John, over 25</p>");
    });

    test("should work with nested plugins in conditions", async () => {
      await createTestFile(
        "views/condition-nested.html",
        "{{~ if (equals(uppercase(name), 'JOHN')) }}<p>Hello John</p>{{~ else }}<p>Hello stranger</p>{{~ endif }}",
      );
      const engine = createTestEngine();
      engine.registerPlugin("equals", (a: string, b: string) => a === b);
      engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());
      const result = await engine.render("condition-nested", { name: "john" });
      expect(result).toBe("<p>Hello John</p>");
    });
  });

  describe("Loops with Plugins", () => {
    test("should work with plugins in loop expressions", async () => {
      await createTestFile("views/loop-plugin.html", "{{~ for item in reverse(items) }}<p>{{ item }}</p>{{~ endfor }}");
      const engine = createTestEngine();
      engine.registerPlugin("reverse", (arr: any[]) => [...arr].reverse());
      const result = await engine.render("loop-plugin", { items: ["a", "b", "c"] });
      expect(result).toBe("<p>c</p><p>b</p><p>a</p>");
    });

    test("should work with plugins in key-value loops", async () => {
      await createTestFile(
        "views/loop-plugin-kv.html",
        "{{~ for [key, value] in uppercaseKeys(obj) }}<p>{{ key }}: {{ value }}</p>{{~ endfor }}",
      );
      const engine = createTestEngine();
      engine.registerPlugin("uppercaseKeys", (obj: Record<string, any>) => {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toUpperCase(), v]));
      });
      const result = await engine.render("loop-plugin-kv", { obj: { name: "John", age: 30 } });
      expect(result).toBe("<p>NAME: John</p><p>AGE: 30</p>");
    });

    test("should work with complex plugins in loops", async () => {
      await createTestFile(
        "views/loop-complex.html",
        "{{~ for item in filter(items, 'active') }}<p>{{ item.name }}</p>{{~ endfor }}",
      );
      const engine = createTestEngine();
      engine.registerPlugin("filter", (items: any[], status: string) => {
        return items.filter((item) => item.status === status);
      });
      const result = await engine.render("loop-complex", {
        items: [
          { name: "Item 1", status: "active" },
          { name: "Item 2", status: "inactive" },
          { name: "Item 3", status: "active" },
        ],
      });
      expect(result).toBe("<p>Item 1</p><p>Item 3</p>");
    });

    test("should work with nested plugins in loops", async () => {
      await createTestFile(
        "views/loop-nested.html",
        "{{~ for item in reverse(filter(items, 'active')) }}<p>{{ uppercase(item.name) }}</p>{{~ endfor }}",
      );
      const engine = createTestEngine();
      engine.registerPlugin("reverse", (arr: any[]) => [...arr].reverse());
      engine.registerPlugin("filter", (items: any[], status: string) => {
        return items.filter((item) => item.status === status);
      });
      engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());
      const result = await engine.render("loop-nested", {
        items: [
          { name: "Item 1", status: "active" },
          { name: "Item 2", status: "inactive" },
          { name: "Item 3", status: "active" },
        ],
      });
      expect(result).toBe("<p>ITEM 3</p><p>ITEM 1</p>");
    });

    test("should allow plugins in loops", async () => {
      await createTestFile(
        "views/loop-with-plugin.html",
        `
          {{~ for num in numbers }}            
            {{~ if (isEven(num)) }}
              <div class="even">{{ num }}</div>
            {{~ else }}
              <div class="odd">{{ num }}</div>
            {{~ endif }}
          {{~ endfor }}
        `,
      );

      const engine = createTestEngine();
      engine.registerPlugin("isEven", (number: number) => {
        const num = Number(number);
        return num % 2 === 0;
      });

      const result = await engine.render("loop-with-plugin", {
        numbers: [1, 2, 3, 4],
      });

      expect(result).toContain('<div class="odd">1</div>');
      expect(result).toContain('<div class="even">2</div>');
      expect(result).toContain('<div class="odd">3</div>');
      expect(result).toContain('<div class="even">4</div>');
    });

    test("should handle for loops inside if conditions", async () => {
      await createTestFile(
        "views/if-with-loop.html",
        `
          {{~ if (showNumbers) }}
            {{~ for num in numbers }}
              <div>{{ num }}</div>
            {{~ endfor }}
          {{~ else }}
            <div>No numbers to show</div>
          {{~ endif }}
        `,
      );

      const engine = createTestEngine();

      let result = await engine.render("if-with-loop", {
        showNumbers: true,
        numbers: [1, 2, 3],
      });

      expect(result).toContain("<div>1</div>");
      expect(result).toContain("<div>2</div>");
      expect(result).toContain("<div>3</div>");
      expect(result).not.toContain("No numbers to show");

      result = await engine.render("if-with-loop", {
        showNumbers: false,
        numbers: [1, 2, 3],
      });

      expect(result).not.toContain("<div>1</div>");
      expect(result).not.toContain("<div>2</div>");
      expect(result).not.toContain("<div>3</div>");
      expect(result).toContain("No numbers to show");
    });

    test("should handle nested plugin calls in control logic", async () => {
      await createTestFile(
        "views/nested-plugin-calls.html",
        `
          {{~ if (and(gt(score, 50), lt(score, 100)) }}
            <span class="warning">{{ formatMessage('Score is {0}', score) }}</span>
          {{~ endif }}
        `,
      );

      const engine = createTestEngine();
      engine.registerPlugin("and", (a: boolean, b: boolean) => a && b);
      engine.registerPlugin("gt", (a: number, b: number) => a > b);
      engine.registerPlugin("lt", (a: number, b: number) => a < b);
      engine.registerPlugin("formatMessage", (msg: string, val: any) => msg.replace("{0}", val.toString()));

      const result1 = await engine.render("nested-plugin-calls", { score: 75 });
      const result2 = await engine.render("nested-plugin-calls", { score: 30 });

      expect(result1).toContain('<span class="warning">Score is 75</span>');
      expect(result2).not.toContain("warning");
    });
  });

  describe("Plugins", () => {
    test("should execute registered plugins", async () => {
      await createTestFile("views/plugin.html", "{{ uppercase(name) }}");

      const engine = createTestEngine();
      engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());

      const result = await engine.render("plugin", { name: "test" });
      expect(result).toBe("TEST");
    });
  });

  describe("Variable definitions", () => {
    test("should work with string arguments", async () => {
      await createTestFile("views/var-plugin-string.html", "{{~ var title = uppercase(name) }}<h1>{{ title }}</h1>");

      const engine = createTestEngine();
      engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());

      const result = await engine.render("var-plugin-string", { name: "hello" });

      expect(result).toBe("<h1>HELLO</h1>");
    });

    test("should work with variable arguments", async () => {
      await createTestFile("views/var-plugin-var.html", "{{~ var title = uppercase(name) }}<h1>{{ title }}</h1>");

      const engine = createTestEngine();
      engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());

      const result = await engine.render("var-plugin-var", { name: "world" });

      expect(result).toBe("<h1>WORLD</h1>");
    });

    test("should work with multiple arguments", async () => {
      await createTestFile(
        "views/var-plugin-multi.html",
        "{{~ var greeting = concat('Hello', name, '!') }}<p>{{ greeting }}</p>",
      );

      const engine = createTestEngine();
      engine.registerPlugin("concat", (...args: string[]) => args.join(" "));

      const result = await engine.render("var-plugin-multi", { name: "John" });

      expect(result).toBe("<p>Hello John !</p>");
    });

    test("should work with nested plugins", async () => {
      await createTestFile(
        "views/var-plugin-nested.html",
        "{{~ var title = uppercase(reverse('hello')) }}<h1>{{ title }}</h1>",
      );
      const engine = createTestEngine();
      engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());
      engine.registerPlugin("reverse", (str: string) => str.split("").reverse().join(""));

      const result = await engine.render("var-plugin-nested", {});

      expect(result).toBe("<h1>OLLEH</h1>");
    });

    test("should work with complex expressions", async () => {
      await createTestFile(
        "views/var-plugin-complex.html",
        "{{~ var result = add(multiply(2, 3), subtract(10, 5)) }}<p>{{ result }}</p>",
      );

      const engine = createTestEngine();
      engine.registerPlugin("add", (a: number, b: number) => a + b);
      engine.registerPlugin("multiply", (a: number, b: number) => a * b);
      engine.registerPlugin("subtract", (a: number, b: number) => a - b);

      const result = await engine.render("var-plugin-complex", {});

      expect(result).toBe("<p>11</p>"); // (2*3) + (10-5) = 6 + 5 = 11
    });

    test("should work with arrays and objects in expressions", async () => {
      await createTestFile(
        "views/var-plugin-arrays-objects.html",
        `{{~ var user = {name: 'John', scores: [85, 90, 78]} }}
        {{~ var avgScore = calculateAverage(user.scores) }}
        {{~ var bonus = applyBonus(user, 5) }}
        <div>{{ user.name }}'s average: {{ avgScore }} (with bonus: {{ bonus }})</div>`,
      );

      const engine = createTestEngine();
      engine.registerPlugin("calculateAverage", (scores: number[]) => {
        const sum = scores.reduce((a, b) => a + b, 0);
        return (sum / scores.length).toFixed(2);
      });

      engine.registerPlugin("applyBonus", (user: any, bonus: number) => {
        const avg = user.scores.reduce((a: number, b: number) => a + b, 0) / user.scores.length;
        return (avg + bonus).toFixed(2);
      });

      const result = await engine.render("var-plugin-arrays-objects", {});

      // Expected calculations:
      // Average: (85 + 90 + 78) / 3 = 253 / 3 = 84.33
      // With bonus: 84.33 + 5 = 89.33
      expect(result.trim()).toBe(`<div>John's average: 84.33 (with bonus: 89.33)</div>`);
    });

    test("should handle undefined plugins gracefully", async () => {
      await createTestFile("views/var-plugin-undefined.html", "{{~ var title = unknown('test') }}<h1>{{ title }}</h1>");

      const engine = createTestEngine();
      const result = await engine.render("var-plugin-undefined", {});

      expect(result).toBe("<h1></h1>");
    });

    test("should work with escaped output", async () => {
      await createTestFile(
        "views/var-plugin-escaped.html",
        "{{~ var html = toHtml('<script>alert(\"xss\")</script>') }}<div>{{{ html }}}</div>",
      );
      const engine = createTestEngine();
      engine.registerPlugin("toHtml", (str: string) => str);
      const result = await engine.render("var-plugin-escaped", {});
      expect(result).toBe('<div><script>alert("xss")</script></div>');
    });
  });

  describe("Modules", () => {
    test("should resolve paths with modules", async () => {
      await createTestFile("views/admin/index.html", "Admin View");
      const engine = createTestEngine({
        path: {
          views: join(TEST_DIR, "views/**"),
        },
        useModules: true,
      }).module("admin");

      const result = await engine.render("index");
      expect(result).toBe("Admin View");
    });
  });

  describe("Error Handling", () => {
    test("should throw error for missing template", async () => {
      const engine = createTestEngine();
      await expect(engine.render("missing")).rejects.toThrow("No files found");
    });

    test("should throw error for missing layout", async () => {
      await createTestFile("views/page.html", "{{= layout('invalid') }}");
      const engine = createTestEngine();
      await expect(engine.render("page")).rejects.toThrow();
    });
  });

  describe("renderTemplate", () => {
    test("should render template with absolute path", async () => {
      await createTestFile("views/custom.html", "Custom Template");
      const engine = createTestEngine();
      const result = await engine.renderTemplate("test-temp/views/custom");
      expect(result).toBe("Custom Template");
    });
  });

  describe("configure", () => {
    test("should configure engine in application", () => {
      const engine = createTestEngine();
      const mockApp = {
        engine: {
          set: mock(),
        },
      };
      engine.configure(mockApp as unknown as Application);
      expect(mockApp.engine.set).toHaveBeenCalledWith(engine);
    });
  });

  describe("Security", () => {
    test("should escape HTML injection", async () => {
      await createTestFile("views/security.html", "{{ unsafe }}");
      const engine = createTestEngine();
      const maliciousInput = "<script>alert('xss')</script>";
      const result = await engine.render("security", { unsafe: maliciousInput });
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });
  });

  describe("Complex Expressions", () => {
    test("should handle nested expressions", async () => {
      await createTestFile("views/nested.html", "{{ a.b.c }}");
      const engine = createTestEngine();
      const data = { a: { b: { c: "Nested" } } };
      const result = await engine.render("nested", data);
      expect(result).toBe("Nested");
    });
  });
});
