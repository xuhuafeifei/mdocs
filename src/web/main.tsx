/**
 * mdocs 前端入口文件
 * 负责挂载 React 应用到 DOM，并注入全局 Provider（主题、国际化、路由）
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
/** Deep imports — barrel `@lobehub/ui` pulls Highlighter/shiki into the first paint.
 * Package exports map `./es/*.mjs`, so paths must include `/index`. */
// 注意：@lobehub/ui 的 ConfigProvider 两处导出形状不一致 ——
//   index.d.mts: export { ConfigProvider }（具名）
//   index.mjs  : export { ConfigProvider as default }（默认）
// 运行时以 .mjs 为准（Vite 走 exports 的 import 条件），所以必须 default 导入；
// 改成具名会在浏览器里炸 "does not provide an export named 'ConfigProvider'"。
// @ts-expect-error d.mts 与 index.mjs 不一致；上游修好后此行会报 unused，届时删掉即可
import ConfigProvider from "@lobehub/ui/es/ConfigProvider/index";
import ThemeProvider from "@lobehub/ui/es/ThemeProvider/index";
import { motion } from "motion/react";
import { Router } from "./app/Router";
import { I18nProvider } from "./i18n";
import "./styles/global.css";

/**
 * 兼容「路径式」文档链接（Agent / 旧习惯常发 `http://host/doc/<id>`）。
 * 本应用使用 HashRouter，规范地址为 `http://host/#/doc/<id>`。
 * 若不纠正，会停留在无 hash 的 /doc/...，再 navigate 时变成
 * `/doc/旧id#/doc/新id`，表现为点不开或跳错文。
 */
function redirectPathDocUrlToHash(): void {
  const { pathname, hash, search, origin } = window.location;
  const base = import.meta.env.BASE_URL || "/";
  const basePath = base.endsWith("/") ? base.slice(0, -1) : base;

  let appPath = pathname;
  if (basePath && appPath.startsWith(basePath)) {
    appPath = appPath.slice(basePath.length) || "/";
  }

  const pathMatch = appPath.match(/^\/doc\/([^/]+)\/?$/);
  if (!pathMatch) return;

  const hashMatch = hash.match(/^#\/doc\/([^/?#]+)/);
  const documentId = hashMatch?.[1] ?? pathMatch[1];
  if (!documentId) return;

  const prefix = base.endsWith("/") ? base : `${base}/`;
  window.location.replace(`${origin}${prefix}${search}#/doc/${documentId}`);
}

redirectPathDocUrlToHash();

/**
 * 获取根 DOM 节点并挂载 React 应用。
 * StrictMode 仅在开发环境触发双重渲染，用于检测副作用。
 */
const container = document.getElementById("root");
if (!container) throw new Error("root element missing");
createRoot(container).render(
  <React.StrictMode>
    <ConfigProvider motion={motion}>
      <ThemeProvider>
        <I18nProvider>
          <HashRouter>
            <Router />
          </HashRouter>
        </I18nProvider>
      </ThemeProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
