import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// 1. Read FRONTEND_PORT or VITE_PORT dynamically from root D:\New-HRMS\.env
const env = loadEnv(process.env["NODE_ENV"] || "development", rootDir, "");
const port = env["FRONTEND_PORT"] || env["VITE_PORT"] || "5173";
const host = env["FRONTEND_HOST"] || env["HOST"] || (process.platform === "win32" ? "localhost" : "0.0.0.0");

console.log(`\n[Nitro Preview] Starting preview server on host: ${host}, port: ${port} ...\n`);

const nitroCliPath = path.resolve(__dirname, "node_modules", "nitro", "dist", "cli", "index.mjs");

// 2. Launch nitro preview with the dynamic port & host using node directly
const child = spawn(process.execPath, [nitroCliPath, "preview", "--port", String(port), "--host", String(host)], {
  stdio: "inherit",
  cwd: __dirname,
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
