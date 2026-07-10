import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import pkg from "./package.json";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [vue()],
  // 把 package.json 的 version 注入为全局常量,供"关于"对话框等处使用
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
