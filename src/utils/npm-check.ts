import { join } from "node:path";

export async function checkNpmVersion(): Promise<void> {
  // Executa toda a verificação de forma assíncrona, não travando o Call Stack do Bun
  Bun.spawn(["bun", "-e", `
    const pkgName = "harpiats";
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
            return; // Cache válido (menos de 24h)
          }
        }
        
        const response = await fetch(\`https://registry.npmjs.org/\${pkgName}/latest\`);
        
        if (!response.ok) return;
        
        const data = await response.json();
        const latestVersion = data.version;
        
        if (latestVersion && latestVersion !== currentVersion) {
          console.log(\`\\x1b[33m\\n[Harpia] Uma nova versão do HarpiaTS está disponível! (\${currentVersion} -> \${latestVersion})\\x1b[0m\`);
          console.log(\`\\x1b[33mExecute 'bun add harpiats@latest' para atualizar.\\n\\x1b[0m\`);
        }
        
        await Bun.write(cacheFile, new Date().toISOString());
      } catch (e) {
        // Falha silenciosa para não quebrar a experiência do desenvolvedor
      }
    }
    
    check();
  `], {
    stdout: "inherit",
    stderr: "ignore",
  });
}

