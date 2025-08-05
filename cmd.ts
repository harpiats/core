import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const npmBinPath = path.join(process.cwd(), "node_modules", ".bin");

const execCommand = (command: string): void => {
  try {
    execSync(command, {
      stdio: "inherit",
      env: { ...process.env, PATH: `${npmBinPath}:${process.env.PATH}` },
    });
  } catch (_) {
    console.log("\n");
    console.log("Process Interrupted");

    process.exit(0);
  }
};

const testSequential = (targetPath: string) => {
  const findTestFiles = (dir: string): string[] => {
    let files: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files = files.concat(findTestFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
        files.push(fullPath);
      }
    }

    return files;
  };

  const fullTargetPath = path.join(process.cwd(), targetPath);

  if (!fs.existsSync(fullTargetPath)) {
    process.exit(1);
  }

  const testFiles = findTestFiles(fullTargetPath);

  for (const file of testFiles) {
    try {
      execCommand(`bun test ${file}`);
    } catch (_) {}
  }
};

export const run = (script: string, args: string[]): void => {
  const commands: any = {
    tests: () => {
      const shouldRunInBand = args.includes("--runInBand");
      const filteredArgs = args.filter((arg) => !arg.startsWith("--"));
      const firstArg = filteredArgs[0];

      if (shouldRunInBand) {
        const startTime = performance.now();
        testSequential("src/tests");
        const endTime = performance.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Total time for tests: ${totalTime} seconds`);

        return;
      }

      if (!firstArg) {
        execCommand("bun test src/tests");
        return;
      }

      execCommand(`bun test src/tests/${firstArg}.spec.ts`);
      return;
    },

    lint: () => {
      const baseCommand = "bunx --bun biome lint --write --unsafe";
      const [filePath] = args;

      if (args.length === 0) {
        execCommand(`${baseCommand} src`);
      } else {
        const isTestDir = filePath.includes("tests/");
        const fileSuffix = isTestDir ? ".spec.ts" : ".ts";

        execCommand(`${baseCommand} src/${filePath}${fileSuffix}`);
      }
    },
  };

  if (commands[script]) {
    commands[script](args);
  } else {
    console.log(`Script "${script}" not found`);
  }
};

const [, , script, ...args] = process.argv;

run(script, args);
