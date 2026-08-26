import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(async () => {
  // Lazy-load the TanStack router module to bypass the initial ESM require bug
  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");

  return {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
    plugins: [
      tanstackStart(),
      react(), // Explicitly injected to restore the missing /@react-refresh runtime
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
