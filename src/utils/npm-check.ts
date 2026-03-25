import { join } from "node:path";

export async function checkNpmVersion(): Promise<void> {
  // Runs the entire check asynchronously, without blocking Bun's Call Stack
  Bun.spawn(["bun", "-e", `
    const pkgName = "@harpia/core";
    const cacheFile = "${join(process.cwd(), "node_modules", ".harpia_cache")}";
    const pkgFile = "${join(process.cwd(), "package.json")}";
    
    async function check() {
      try {
        const fs = typeof Bun !== "undefined" ? Bun : require("fs/promises");
        
        let currentVersion = "unknown";
        if (await Bun.file(pkgFile).exists()) {
          const pkgData = await Bun.file(pkgFile).json();
          currentVersion = pkgData.version;
        }

        const file = Bun.file(cacheFile);
        
        if (await file.exists()) {
          const stats = await file.text();
          const lastCheck = new Date(stats).getTime();
          const now = Date.now();
          const oneday = 24 * 60 * 60 * 1000;
          
          if (now - lastCheck < oneday) {
            return; // Valid cache (less than 24h)
          }
        }
        
        const response = await fetch("https://registry.npmjs.org/" + pkgName + "/latest");
        
        if (!response.ok) return;
        
        const data = await response.json();
        const latestVersion = data.version;
        
          console.log("\x1b[33m\n[Harpia] A new version of Harpia is available! (" + currentVersion + " -> " + latestVersion + ")\x1b[0m");
          console.log("\x1b[33mRun 'bun add @harpia/core@latest' to update.\n\x1b[0m");
        }
        
        await Bun.write(cacheFile, new Date().toISOString());
      } catch (e) {
        // Silent failure so as not to break the developer experience
      }
    }
    
    check();
  `], {
    stdout: "inherit",
    stderr: "ignore",
  });
}

