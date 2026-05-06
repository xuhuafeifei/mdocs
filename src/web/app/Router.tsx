/**
 * 应用路由配置
 * 定义了三个路由：首页、文档详情页、编辑器 Playground 演示页
 */
import { Routes, Route } from "react-router-dom";
import { App } from "./App";
import { PlaygroundPage } from "./playground/PlaygroundPage";

/**
 * 应用路由组件：定义首页、文档页、Playground 三个路由。
 */
export function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/doc/:documentId" element={<App />} />
      <Route path="/playground" element={<PlaygroundPage />} />
    </Routes>
  );
}
