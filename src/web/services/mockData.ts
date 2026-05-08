/**
 * Demo Mode Mock 数据
 * 在没有后端时，提供演示用的虚拟数据
 */
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode, TreeFolderNode } from "../../shared/types/tree";

/** Demo 访客 ID */
export const DEMO_VISITOR_ID = "demo-visitor-001";

/** Demo Token（仅用于标识 demo mode） */
export const DEMO_TOKEN = "demo-mode-token";

/** 默认访客信息 */
export const DEMO_VISITOR: VisitorPublic = {
  visitorId: DEMO_VISITOR_ID,
  visitorName: "Demo User",
  createdAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  disabledAt: null,
  mergedIntoVisitorId: null,
};

/** 默认域列表 */
export const DEMO_DOMAINS: DomainSummary[] = [
  {
    domainId: "default",
    domainName: "默认域",
    permission: "public",
    creatorVisitorId: DEMO_VISITOR_ID,
    docCount: 3,
  },
  {
    domainId: DEMO_VISITOR_ID,
    domainName: "我的个人域",
    permission: "private",
    creatorVisitorId: DEMO_VISITOR_ID,
    docCount: 1,
  },
];

/** 计算内容 hash（Demo 用简单模拟） */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

/** 示例文档内容 */
const WELCOME_CONTENT = `# 欢迎使用 mdocs Demo 🎉

这是 mdocs 的纯前端演示模式，所有数据存储在你的浏览器中。

## 功能说明

- ✅ **创建文档和文件夹**：点击侧边栏按钮
- ✅ **Markdown 编辑**：支持完整的 Markdown 语法
- ✅ **图表和公式**：支持流程图、序列图、数学公式
- ✅ **本地草稿**：自动保存到浏览器 IndexedDB

## 注意事项

⚠️ **Demo 模式限制**：
- 数据只保存在你的浏览器中
- 刷新页面数据仍然保留
- 清除浏览器数据会丢失所有文档

## 开始使用

1. 点击左侧 **"新建文档"** 按钮
2. 输入文件名，开始编辑
3. 点击 **"发布"** 保存到本地存储

Enjoy! 🚀
`;

const MARKDOWN_GUIDE_CONTENT = `# Markdown 语法指南

## 基础格式

**粗体文本**、*斜体文本*、~~删除线~~

## 列表

### 无序列表
- 项目一
- 项目二
  - 嵌套项目

### 有序列表
1. 第一项
2. 第二项
3. 第三项

## 代码

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## 表格

| 功能 | 支持 |
|------|------|
| Markdown | ✅ |
| 图表 | ✅ |
| 公式 | ✅ |

## 引用

> 这是一段引用文本
> 可以有多行

## 链接和图片

[访问 GitHub](https://github.com)

## 数学公式（KaTeX）

行内公式：$E = mc^2$

块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$
`;

const DIAGRAM_GUIDE_CONTENT = `# 图表支持示例

mdocs 集成了多种图表类型。

## Mermaid 流程图

\`\`\`mermaid
flowchart LR
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D
\`\`\`

## Mermaid 序列图

\`\`\`mermaid
sequenceDiagram
    participant 用户
    participant 前端
    participant 后端

    用户->>前端: 输入内容
    前端->>后端: 提交数据
    后端-->>前端: 返回结果
    前端-->>用户: 显示成功
\`\`\`

## Mermaid 甘特图

\`\`\`mermaid
gantt
    title 项目进度
    dateFormat  YYYY-MM-DD
    section 设计
    需求分析     :done,    des1, 2024-01-01, 5d
    技术选型     :done,    des2, after des1, 3d
    section 开发
    前端开发     :active,  dev1, 2024-01-09, 10d
    后端开发     :         dev2, 2024-01-09, 10d
\`\`\`
`;

const PERSONAL_NOTE_CONTENT = `# 个人笔记

这是我的私人域中的笔记，只有我能看到。

## 今日待办

- [x] 完成 mdocs demo 模式
- [ ] 测试所有功能
- [ ] 部署到 GitHub Pages

## 想法

Demo 模式的核心设计：
1. API 层透明切换
2. 数据存储在 IndexedDB
3. 用户无感知切换

`;

/** 默认文档 */
export const DEMO_DOCUMENTS: DocumentDetail[] = [
  {
    documentId: "doc-welcome",
    relativePath: "欢迎使用.md",
    displayName: "欢迎使用",
    content: WELCOME_CONTENT,
    contentHash: hashContent(WELCOME_CONTENT),
    permission: 1,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId: "default",
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    documentId: "doc-markdown-guide",
    relativePath: "指南/Markdown 语法.md",
    displayName: "Markdown 语法",
    content: MARKDOWN_GUIDE_CONTENT,
    contentHash: hashContent(MARKDOWN_GUIDE_CONTENT),
    permission: 1,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId: "default",
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    documentId: "doc-diagram-guide",
    relativePath: "指南/图表支持.md",
    displayName: "图表支持",
    content: DIAGRAM_GUIDE_CONTENT,
    contentHash: hashContent(DIAGRAM_GUIDE_CONTENT),
    permission: 1,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId: "default",
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    documentId: "doc-personal-note",
    relativePath: "个人笔记.md",
    displayName: "个人笔记",
    content: PERSONAL_NOTE_CONTENT,
    contentHash: hashContent(PERSONAL_NOTE_CONTENT),
    permission: 0,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId: DEMO_VISITOR_ID,
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

/**
 * 构建文档树
 */
export function buildTree(docs: DocumentDetail[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeFolderNode>();

  // 按路径排序，确保父文件夹先创建
  const sortedDocs = [...docs].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  for (const doc of sortedDocs) {
    const parts = doc.relativePath.split("/");
    const fileName = parts.pop()!;

    let currentPath = "";
    let parentNodes: TreeNode[] = root;

    // 逐层创建文件夹
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let folderNode = folderMap.get(currentPath);
      if (!folderNode) {
        folderNode = {
          type: "folder",
          name: part,
          path: currentPath,
          documentId: `folder-${currentPath}`,
          children: [],
        };
        parentNodes.push(folderNode);
        folderMap.set(currentPath, folderNode);
      }
      parentNodes = folderNode.children;
    }

    // 添加文档节点
    parentNodes.push({
      type: "document",
      name: fileName,
      path: doc.relativePath,
      documentId: doc.documentId,
      displayName: doc.displayName || fileName.replace(/\.md$/, ""),
      ownerVisitorId: doc.ownerVisitorId,
      updatedAt: doc.updatedAt,
    });
  }

  return root;
}
