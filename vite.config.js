import { defineConfig } from "vite";

export default defineConfig({
  base: "/online-museum-demo/", // GitHub Pages 项目站点子路径
  server: { port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: "index.html",       // 博物馆 demo
        nav: "nav.html",          // 具身导航框架雏形
      },
    },
  },
});
