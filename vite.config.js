import { defineConfig } from "vite";

export default defineConfig({
  base: "/online-museum-demo/", // GitHub Pages 项目站点子路径
  server: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
});
