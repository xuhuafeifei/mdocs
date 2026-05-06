/**
 * mdocs 前端入口文件
 * 负责挂载 React 应用到 DOM，并注入全局 Provider（主题、国际化、路由）
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, ThemeProvider } from "@lobehub/ui";
import { motion } from "motion/react";
import { Router } from "./app/Router";
import { I18nProvider } from "./i18n";
import "./styles/global.css";

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
          <BrowserRouter>
            <Router />
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
