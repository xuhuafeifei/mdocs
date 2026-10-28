import path from "node:path";
import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const shikiPkg = path.dirname(require.resolve("shiki/package.json"));
const lobeEditorPkg = path.dirname(require.resolve("@lobehub/editor/package.json"));

export default defineConfig({
  root: path.resolve(__dirname, "src/web"),
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
    // Transform the shell early so first paint isn't waiting on random discovery order.
    warmup: {
      clientFiles: ["./main.tsx", "./app/Router.tsx", "./app/App.tsx", "./i18n/index.ts"],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/web"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@lobehub/editor") || id.includes("lexical")) {
            return "editor";
          }
          if (id.includes("@lobehub/ui") || id.includes("antd") || id.includes("antd-style")) {
            return "ui";
          }
          if (id.includes("@meta2d") || id.includes("canvas2svg")) {
            return "meta2d";
          }
          if (id.includes("mermaid") || id.includes("cytoscape") || id.includes("@braintree")) {
            return "diagram";
          }
          if (id.includes("motion") || id.includes("framer-motion")) {
            return "motion";
          }
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("react-router") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "@shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@shiki", replacement: path.resolve(__dirname, "src/web/shiki/index.ts") },
      { find: "shiki/themes", replacement: path.join(shikiPkg, "dist/themes.mjs") },
      { find: "shiki/engine/oniguruma", replacement: path.join(shikiPkg, "dist/engine-oniguruma.mjs") },
      { find: "shiki/core", replacement: path.join(shikiPkg, "dist/core.mjs") },
      { find: "shiki/engine/javascript", replacement: path.join(shikiPkg, "dist/engine-javascript.mjs") },
      { find: "shiki/wasm", replacement: path.join(shikiPkg, "dist/wasm.mjs") },
      // Exact `shiki` only — do not shadow `shiki/wasm`, `shiki/themes`, etc.
      { find: /^shiki$/, replacement: path.resolve(__dirname, "src/web/shiki/shiki-shim.ts") },
      // file: 依赖下 Vite 可能解析不了 package exports 子路径；显式指到 es/
      {
        find: /^@lobehub\/editor\/renderer$/,
        replacement: path.join(lobeEditorPkg, "es/renderer.js"),
      },
      {
        find: /^@lobehub\/editor\/react$/,
        replacement: path.join(lobeEditorPkg, "es/react.js"),
      },
      {
        find: /^@lobehub\/editor\/headless$/,
        replacement: path.join(lobeEditorPkg, "es/headless.js"),
      },
    ],
  },
  optimizeDeps: {
    // First-paint only. Do NOT include `@lobehub/ui` / `@lobehub/editor` here:
    // their package entries pull Highlighter → shiki (via alias) into a ~16MB
    // prebundle and leave the UI stuck on「加载中...」for many seconds.
    // Editor/UI are discovered when DocumentEditor / playground actually load.
    include: [
      "motion",
      "motion/react",
      "lucide-react",
      "react-router-dom",
      // mermaid 被 exclude 后其 CJS 依赖不会进预构建，浏览器直接吃到裸 CJS：
      // 首屏就报 "does not provide an export named 'sanitizeUrl'"（整页白屏 / 停在「加载中…」）。
      // 逐个 nested include 做 interop；diagram 相关的 CJS 依赖在首次渲染图表时才会加载。
      "mermaid > dayjs",
      "mermaid > dayjs/plugin/advancedFormat",
      "mermaid > dayjs/plugin/customParseFormat",
      "mermaid > dayjs/plugin/duration",
      "mermaid > dayjs/plugin/isoWeek",
      "mermaid > @braintree/sanitize-url",
      "mermaid > roughjs",
      "mermaid > d3-sankey",
      "mermaid > cytoscape-fcose",
      "mermaid > cytoscape-cose-bilkent",
    ],
    // Note: @lobehub/editor has CJS deps (e.g. eventemitter3) that need interop —
    // Vite will optimize it on first editor open (may briefly re-optimize once).
    // mermaid 11 用相对路径动态加载 diagram chunks；预构建会改写成 .vite/deps/
    // 下的假路径（如 sequenceDiagram-*.js），清缓存后就会 Failed to fetch。
    // Keep shiki out of dep prebundle so theme/lang dynamic imports stay lazy.
    exclude: ["mermaid", "shiki", "@shikijs/langs"],
  },
});
