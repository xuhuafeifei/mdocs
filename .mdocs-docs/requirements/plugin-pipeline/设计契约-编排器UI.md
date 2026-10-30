# plugin-pipeline — 增量：编排器 UI 与三维分类

> **状态**：已同意（2026-10-30，产品授权前端自决落地）  
> 父契约：[`设计契约.md`](./设计契约.md)（已同意的底层：YAML、路径、Engram 隔离、soul）。

## 一句话

**流水线是核心资产；插件是面向用户的实例。**  
YAML = 协议与高级视图；普通用户主界面 = **有序步骤编排器**（非自由画布、非纯 YAML）。

## 三维分类（勿混）

| 维度 | 取值 | 说明 |
|------|------|------|
| **是什么** | `skill` / `mcp`（可多出口） | 面向 Agent 的能力种类 |
| **怎么装**（安装方式） | 本地程序型 / 命令启动型 / 远程服务型（MCP）；Skill 包下载等 | 决定默认步骤模板 |
| **属于谁** | `system` / `user`（实例） / `tenant`（访客） | 定义落盘位置与权限叙事 |

**传输方式**（`stdio` | `http`）只属于 `upsert_mcp.transport`，**不是**与「安装方式」同级的分类。

### MCP 安装方式 ↔ 典型流水线

| 安装方式 | 典型 steps | upsert_mcp |
|----------|------------|------------|
| A 本地程序型 | download → extract → exec? → upsert_mcp | `transport: stdio` + 指向 install 内二进制 |
| B 命令启动型 | （可选环境检查）→ upsert_mcp | `transport: stdio` + `npx`/`uvx`/`node` 等 command |
| C 远程服务型 | upsert_mcp（填 URL/headers） | `transport: http` |

Engram = A + stdio。新建向导：先选 Skill/MCP，再选安装方式，再生成默认 steps。

## 前端信息架构

### 插件市场（管理页）

- 筛选：**全部 / Skill / MCP**（是什么）  
- 区块：**已安装** | **可安装/目录** | **新建**  
- 来源标签：系统自带 / 自定义 / Tenant（属于谁）——作 badge，不作唯一 Tab 轴  
- 卡片动作：查看详情 | 编辑流水线 | 安装/卸载  

过渡页上的「系统 / 自定义」双栏可废弃，改为上述结构。

### 插件详情

元信息、安装态、运行态、安装记录、存储路径只读展示（install / plugins-data / soul 旁路）、安装/卸载入口。

### 流水线编辑器（核心）

```
┌ 可视化 | YAML 源码 ─┐
├ 安装流程 | 卸载流程 ─┤
├ 独立区：Probe（安装检测）┤
├ 左：步骤列表（拖拽排序）┤
├ 右：当前步骤表单      ┤
└ 底/旁：校验错误、风险提示┘
```

- **可视化** 与 **YAML** 共享同一 AST（parse → edit → validate → serialize）；切换前校验，不静默丢改。  
- 步骤：增删改、排序、禁用、复制、条件（`when`）。  
- **Probe** 与 **steps** 分栏编辑（不混进普通步骤列表）。  
- **安装 / 卸载** 两条流水线两个 Tab（对应 YAML `steps` / `uninstall`）。  
- 纵向步骤列表，**不做** n8n 式自由连线画布。  
- Tenant/任意 download·exec：安装确认与执行窗必须展示命令、URL、**非沙箱**风险文案。

### 安装执行器

按步骤状态（pending / skipped_by_probe / running / done / error）+ 聚合日志（stdout/stderr）+ 失败定位；二次安装明示 skip。

## 步骤类型 Schema 驱动（防前端写死）

后端提供 `GET /api/plugins/step-definitions`（名称待定），返回：

```ts
type PipelineStepDefinition = {
  type: string;
  label: string;
  description: string;
  category: "install" | "configure" | "uninstall" | "probe";
  fields: Array<{
    name: string;
    type: "text" | "textarea" | "string[]" | "select" | "keyvalue" | "bool";
    required?: boolean;
    default?: unknown;
    options?: unknown[];
    description?: string;
  }>;
};
```

- 通用表单由 Schema 渲染。  
- `upsert_mcp` / `upsert_skill` 可挂**专用高级表单**（transport 切换显隐 command vs url）。  
- 新增 step type = 后端注册定义 + handler；前端无特例爆炸。

### 步骤类型基线（与父契约对齐；可增）

| type | 类别 |
|------|------|
| download / extract / exec | install |
| copy_file（**待加**） | install |
| upsert_mcp / upsert_skill | configure |
| write_soul_sidecar | configure |
| delete_soul_sidecar / remove_mcp / remove_skill（**待加**） | uninstall |
| probe: file_exists / http_health / npm_global | probe（独立区） |

## 数据流

```
pipeline.yaml ⇄ YAML Parser ⇄ Pipeline AST
                    ├── Visual Editor
                    └── YAML Editor
                           ↓
                    Schema Validation
                           ↓
                    pipeline.yaml / .default
```

`plugins.json` 仍是**安装态索引**；流水线正文只在 YAML。

## 一期优先级（本增量）

| 优先级 | 功能 |
|--------|------|
| P0 | Skill/MCP × 安装方式分类；市场列表改版 |
| P0 | 可视化步骤列表 + 参数表单（Schema） |
| P0 | YAML 解析/校验/保存；系统恢复初始 |
| P0 | 安装进度按步骤 + 日志（接解释器事件） |
| P1 | Probe 独立配置；安装/卸载双 Tab |
| P1 | 可视化 ↔ YAML 双向同步打磨 |
| P2 | 步骤模板/复制；导入导出 |

## 非目标（本增量仍不做）

- 自由画布编排  
- Agent 自动生成流水线  
- 假装沙箱的安全执行环境  

## 与过渡 UI 的关系

当前 `PluginMarketplacePanel`（系统/自定义 + 大文本框）= **脚手架**；本增量同意后替换为编排器，不在过渡 UI 上堆功能。
