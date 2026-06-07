import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // base: "/redred/",
  plugins: [react()],
  server: {
    proxy: {
      "/hf": {
        target: "https://huggingface.co",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hf/, ""),
      },
    },
  },
});
