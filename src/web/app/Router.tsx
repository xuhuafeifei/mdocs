/**
 * 应用路由配置
 * 定义了三个路由：首页、文档详情页、编辑器 Playground 演示页
 *
 * App 必须只挂一份：`/` 与 `/doc/:id` 若各写一个 `<App />`，
 * 来回跳会卸载重挂 → phase 回到 loading → 整页「加载中...」。
 */
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { App } from "./App";

const PlaygroundPage = lazy(() =>
  import("./playground/PlaygroundPage").then((m) => ({ default: m.PlaygroundPage })),
);

/**
 * 应用路由组件：定义首页、文档页、Playground 三个路由。
 */
export function Router() {
  return (
    <Routes>
      <Route
        path="/playground"
        element={
          <Suspense fallback={<div style={{ padding: 24 }}>Loading playground…</div>}>
            <PlaygroundPage />
          </Suspense>
        }
      />
      {/* 单一 App 实例；文档 id 由 App 内 useMatch("/doc/:documentId") 读取 */}
      <Route path="*" element={<App />} />
    </Routes>
  );
}
