/**
 * mdocs 前端入口文件
 * 负责挂载 React 应用到 DOM，并注入全局 Provider（主题、国际化、路由）
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ConfigProvider, ThemeProvider } from "@lobehub/ui";
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
