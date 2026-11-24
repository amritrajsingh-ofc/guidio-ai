import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

// Run "npm run analyze" to build and write dist/stats.html.
// It uses Vite's --mode flag, so it works on Windows, macOS and Linux.
// The old ANALYZE=true variable still works where the shell supports it.
export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze" || process.env.ANALYZE === "true";

  return {
    plugins: [
      react(),
      tailwindcss(),
      analyze &&
        visualizer({
          filename: "dist/stats.html",
          gzipSize: true,
          open: false,
        }),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": import.meta.dirname + "/src",
      },
    },

    server: {
      port: 5173,
      host: true,
    },
  };
});