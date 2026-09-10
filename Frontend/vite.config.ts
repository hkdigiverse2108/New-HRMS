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

// Load environment variables from root D:\New-HRMS\.env
const env = loadEnv(process.env['NODE_ENV'] || "development", rootDir, "");
const frontendPort = parseInt(env['FRONTEND_PORT'] || env['VITE_PORT'] || "5173", 10);

// Expose all VITE_* variables from root .env to frontend
const viteEnvDefines: Record<string, string> = {};
for (const [key, value] of Object.entries(env)) {
  if (key.startsWith("VITE_")) {
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
