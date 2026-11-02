import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 建置到 hlm 站的 play/（index.html＋assets/），由 Pages 靜態服務；題庫分片 play/bank/ 與美術 play/art/ 是另外提交的檔案，
// 所以不清空輸出目錄、不用 publicDir。舊的 assets/ 由 npm run build 先刪。
export default defineConfig({
  base: "/play/",
  publicDir: false,
  plugins: [react()],
  build: { outDir: "../../../play", emptyOutDir: false, assetsDir: "assets", chunkSizeWarningLimit: 600 },
});
