import { Link } from "react-router-dom";

import PlaygroundEditor from "./PlaygroundEditor";

/**
 * 独立编辑器 Playground 演示页
 * 等价于 lobe-editor 官方文档中的 playground，用于本地调试编辑器功能。
 * 访问路径：/playground
 */
/**
 * Playground 页面组件：提供返回首页链接并渲染编辑器。
 */
export function PlaygroundPage() {
  return (
    <div className="mdocs-playground-page">
      <header className="mdocs-playground-header">
        <Link className="mdocs-playground-back" to="/">
          ← mdocs
        </Link>
      </header>
      <PlaygroundEditor />
    </div>
  );
}
