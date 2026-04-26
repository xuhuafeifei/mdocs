# 测试计划

## 当前状态

- 测试框架：**vitest**（已安装，未配置）
- 现有测试：`src/web/hooks/useDiagramPreview/diagramUtils.test.ts`（纯函数测试，未接入 CI）
- `package.json` 中无 `test` 脚本，无 vitest 配置，无 CI 流程

## 基础设施（第一步）

1. 添加 `test` 脚本到 `package.json`：`"test": "vitest run"`、`"test:watch": "vitest"`
2. 创建 `vitest.config.ts`（与 `vite.config.ts` 共用插件和别名）
3. 确定测试文件命名约定：`*.test.ts` / `*.test.tsx`，放在被测模块旁边

```ts
// vitest.config.ts（参考）
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
```

## 测试分层

### 第 1 层：Shared 纯函数（优先覆盖）

这些模块无副作用、不依赖 DOM/React，测试成本最低、收益最高。


| 模块                             | 测试内容                                                                                                                                                | 优先级 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `src/shared/docPath.ts`        | `normaliseDocRelativePath`：正常路径、边界（空、根、尾斜杠、中文）、非法输入（..、绝对路径、非法字符）                                                                                   | P0  |
| `src/shared/storagePath.ts`    | `normalisePathSegmentForStorage`、`normaliseRelativePathForStorage`、`parseDisplayNameFolder`、`parseDisplayNameMarkdownFile`：空格→下划线、非法字符拒绝、长名截断、中英文混排 | P0  |
| `src/shared/folderDesc.ts`     | `folderDescPathForFolder`、`isFolderDescPath`                                                                                                        | P0  |
| `src/shared/personalDomain.ts` | `stripDomainPathPrefix`、`isPersonalDomainPath`                                                                                                      | P1  |
| `src/shared/types/api.ts` 等    | 类型定义不需要测试，但可以加 type-level test                                                                                                                      | —   |


### 第 2 层：Server 逻辑


| 模块                                              | 测试内容                           | 优先级 |
| ----------------------------------------------- | ------------------------------ | --- |
| `src/server/documents/tree.service.ts`          | 树构建（parent_id 递归）、desc.md 关联   | P1  |
| `src/server/documents/document.service.ts`      | CRUD、权限鉴权逻辑（五档 × 域类型 × invite） | P1  |
| `src/server/identity/visitor.service.ts`        | visitor 注册、token 签发、身份恢复       | P2  |
| `src/server/domains/personal-domain.service.ts` | 个人域自动创建、域类型校验                  | P2  |
| `src/server/storage/file-store.ts`              | 路径拼接、文件读写、去冲突                  | P2  |


需要建测试 DB（SQLite 内存模式），server 层测试暂缓到 DB 层基础设施就绪。

### 第 3 层：Web 组件


| 模块                      | 测试内容                                                 | 优先级 |
| ----------------------- | ---------------------------------------------------- | --- |
| `DocumentTree`          | 展开/折叠、选中高亮、右键菜单、空白区域 deselect                        | P0  |
| `SettingsPage`          | 渲染配置树、语言切换、返回文档                                      | P0  |
| `App`                   | 整体状态机（loading → needsRegister → ready）、settings 视图切换 | P1  |
| `VisitorRegisterDialog` | 表单验证、提交状态、错误展示                                       | P1  |
| `TreeContextMenu`       | 右键定位、操作回调                                            | P1  |
| `DocumentEditor`        | 编辑渲染、保存回调、只读态                                        | P2  |
| `VisitorIdNotice`       | 展示/关闭                                                | P2  |


使用 `@testing-library/react` 测试组件交互，测试文件放组件同目录。

### 第 4 层：集成 / E2E（待定）

- 浏览器级流程（playwright）：注册 → 创建文档 → 编辑 → 保存 → 刷新验证
- 多用户场景：invite 协作、权限变更
- 需额外 CI 环境，先不列入当前计划

## 按 fgbg 设计文档的测试要点

### 权限模型（`01-permission-model.md`）


| 场景                     | 预期                 | 层级          |
| ---------------------- | ------------------ | ----------- |
| public 域只允许 3/4 档      | 创建/更新档位 0/1/2 被拒   | 单元（service） |
| restricted 域只允许 1/2 档  | 创建/更新档位 0/3/4 被拒   | 单元（service） |
| private 域允许 0～4        | 全部通过               | 单元（service） |
| private 域仅域主一人         | 添加成员被拒             | 单元（service） |
| 五档鉴权组合 × 域类型           | owner 永远可读写等       | 单元（service） |
| invite 与域成员互斥          | 已是域成员时创建 invite 失败 | 单元（service） |
| private 域下对域主创建 invite | 被拒                 | 单元（service） |
| 域绑定后不支持删除              | 删除有文档的域被拒          | 集成          |


### 目录树（`03-directory-tree.md`）


| 场景                          | 预期                 | 层级          |
| --------------------------- | ------------------ | ----------- |
| parent_id 构建树               | 节点按父子关系组织          | 单元（service） |
| 创建 dir 时自动创建 desc.md        | dir + desc.md 两条记录 | 集成          |
| desc.md 不出现在树节点中            | 树 API 返回不含 desc.md | 集成          |
| 前端 selectedParentId 替代 path | 创建文件传入正确 parentId  | 组件          |


### 设置页（SettingsPage）


| 场景                       | 预期                      | 层级  |
| ------------------------ | ----------------------- | --- |
| 点击 visitor footer → 进入设置 | view 切换为 "settings"     | 组件  |
| 配置树高亮 General            | General 项有 active class | 组件  |
| 语言切换 EN/中                | `setLang` 被正确调用         | 组件  |
| 点击「返回文档」→ 回到文档视图         | view 切换为 "docs"         | 组件  |
| i18n：英文下显示 "General"     | 渲染英文词条                  | 组件  |
| i18n：中文下显示 "通用"          | 渲染中文词条                  | 组件  |


## 文件结构建议

```
src/
  shared/
    docPath.test.ts
    storagePath.test.ts
    folderDesc.test.ts
    personalDomain.test.ts   # P1
  web/
    app/
      App.test.tsx            # P1
      SettingsPage.test.tsx   # P0
      DocumentTree.test.tsx   # P0
      TreeContextMenu.test.tsx # P1
      VisitorRegisterDialog.test.tsx # P1
      VisitorIdNotice.test.tsx # P2
    hooks/
      useDiagramPreview/
        diagramUtils.test.ts  # 已有
  server/
    documents/
      tree.service.test.ts    # P1（需 DB）
      document.service.test.ts # P1（需 DB）
    identity/
      visitor.service.test.ts # P2（需 DB）
```

## 优先级总结


| 优先级    | 内容                                            | 预估工作量 |
| ------ | --------------------------------------------- | ----- |
| **P0** | shared 纯函数 + 关键组件（DocumentTree, SettingsPage） | 2-3 天 |
| **P1** | App 状态机 + 其他组件 + server 核心服务（需 DB infra）      | 3-5 天 |
| **P2** | 次要组件 + 边缘服务 + E2E                             | 待定    |


## 实施步骤

```
Step 1: vitest 配置 + test 脚本 + CI 接入
Step 2: shared 层纯函数测试（docPath, storagePath, folderDesc）
Step 3: 关键组件测试（DocumentTree, SettingsPage）
Step 4: 其余组件测试（App, TreeContextMenu, VisitorRegisterDialog）
Step 5: DB 测试基础设施 + server 层 service 测试
Step 6: 按 fgbg 权限模型补充边界用例
```

