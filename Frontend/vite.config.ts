import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load environment variables from root D:\New-HRMS\.env across dev, prod, and process.env
const loadedEnv: Record<string, string> = {
  ...loadEnv(process.env["NODE_ENV"] || "development", rootDir, ""),
  ...loadEnv("production", rootDir, ""),
  ...(Object.fromEntries(
    Object.entries(process.env).filter(([k, v]) => k.startsWith("VITE_") || k.includes("PORT"))
  ) as Record<string, string>),
};

const frontendPort = parseInt(loadedEnv["FRONTEND_PORT"] || loadedEnv["VITE_PORT"] || "5173", 10);

// Expose all VITE_* variables from root .env and process.env to frontend
const viteEnvDefines: Record<string, string> = {};
for (const [key, value] of Object.entries(loadedEnv)) {
  if (key.startsWith("VITE_") && value !== undefined && value !== "") {
    viteEnvDefines[`import.meta.env.${key}`] = JSON.stringify(value);
  }
}

export default defineConfig(async ({ command }) => {
  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      client: { entry: "client" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    viteReact(),
  ];

  if (command === "build") {
    try {
      const { nitro } = await import("nitro/vite");
      plugins.push(nitro({ preset: "vercel" }));
    } catch {
      // nitro optional if not needed
    }
  }

  return {
    envDir: rootDir,
    define: viteEnvDefines,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      port: frontendPort,
      allowedHosts: ["new-hrms.hkdigiverse.com"],
    },
    plugins,
  };
});
