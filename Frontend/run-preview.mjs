import { loadEnv } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// 1. Read configuration dynamically from root .env
const env = loadEnv(process.env["NODE_ENV"] || "development", rootDir, "");
const port = env["FRONTEND_PORT"] || env["VITE_PORT"] || "5173";
const host = env["FRONTEND_HOST"] || env["HOST"] || (process.platform === "win32" ? "localhost" : "0.0.0.0");
const viteApiUrl = (env["VITE_API_URL"] || process.env["VITE_API_URL"] || "").trim();

// Dynamically sync env-config.js so browser runtime gets exact VITE_API_URL from .env
if (viteApiUrl) {
  const scriptContent = `window.__ENV__ = {\n  VITE_API_URL: "${viteApiUrl}"\n};\n`;
  try {
    const pubDir = path.resolve(__dirname, "public");
    if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
    fs.writeFileSync(path.resolve(pubDir, "env-config.js"), scriptContent, "utf-8");

    const staticDir = path.resolve(__dirname, ".vercel", "output", "static");
    if (fs.existsSync(staticDir)) {
      fs.writeFileSync(path.resolve(staticDir, "env-config.js"), scriptContent, "utf-8");
    }
  } catch (e) {
    console.warn("[Nitro Preview] env-config sync warning:", e.message);
  }
}

console.log(`\n[Nitro Preview] Starting preview server on host: ${host}, port: ${port} (API URL: ${viteApiUrl || 'default'}) ...\n`);

const nitroCliPath = path.resolve(__dirname, "node_modules", "nitro", "dist", "cli", "index.mjs");

// 2. Launch nitro preview with the dynamic port & host using node directly
const child = spawn(process.execPath, [nitroCliPath, "preview", "--port", String(port), "--host", String(host)], {
  stdio: "inherit",
  cwd: __dirname,
  env: {
    ...process.env,
    ...env,
  },
});

// 3. Graceful shutdown on Ctrl+C
const cleanExit = () => {
  if (child && child.pid) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { shell: false });
      } else {
        child.kill("SIGTERM");
      }
    } catch {}
  }
  process.exit(0);
};

process.on("SIGINT", cleanExit);
process.on("SIGTERM", cleanExit);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
