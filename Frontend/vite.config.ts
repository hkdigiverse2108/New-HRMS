// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load environment variables from root D:\New-HRMS\.env across dev, prod, and process.env
const loadedEnv: Record<string, string> = {
  ...loadEnv(process.env['NODE_ENV'] || "development", rootDir, ""),
  ...loadEnv("production", rootDir, ""),
  ...(Object.fromEntries(
    Object.entries(process.env).filter(([k, v]) => k.startsWith("VITE_") || k.includes("PORT"))
  ) as Record<string, string>),
};

const frontendPort = parseInt(loadedEnv['FRONTEND_PORT'] || loadedEnv['VITE_PORT'] || "5173", 10);

// Expose all VITE_* variables from root .env and process.env to frontend
const viteEnvDefines: Record<string, string> = {};
for (const [key, value] of Object.entries(loadedEnv)) {
  if (key.startsWith("VITE_") && value !== undefined && value !== "") {
    viteEnvDefines[`import.meta.env.${key}`] = JSON.stringify(value);
  }
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
  vite: {
    envDir: rootDir,
    define: viteEnvDefines,
    server: {
      port: frontendPort,
    },
  },
});
