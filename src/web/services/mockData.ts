/**
 * Demo Mode Mock 数据
 * 在没有后端时，提供演示用的虚拟数据
 */
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode, TreeFolderNode } from "../../shared/types/tree";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc";
import readmeLexicalSeed from "./demo-seed/README.lexical.json";

/** 欢迎页：内容与 `demo-seed/README.lexical.json` 一致（构建时打包进 bundle） */
const README_LEXICAL_CONTENT = JSON.stringify(readmeLexicalSeed);

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
    relativePath: "README.md",
    displayName: "README",
    content: README_LEXICAL_CONTENT,
    contentHash: hashContent(README_LEXICAL_CONTENT),
    permission: 1,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId: "default",
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    fileType: "md",
    parentId: null,
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
    fileType: "md",
    parentId: null,
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
    fileType: "md",
    parentId: null,
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
    fileType: "md",
    parentId: null,
  },
];

/**
 * 构建文档树：路径推导的虚拟文件夹 + IndexedDB 中真实的目录行（fileType === dir），
 * 并将 ___desc___.md 挂到对应文件夹上（不单独显示为普通文档）。
 */
export function buildTree(docs: DocumentDetail[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeFolderNode>();

  const dirMetaByPath = new Map<string, { documentId: string; displayName: string }>();
  for (const d of docs) {
    if ((d.fileType ?? "md") === "dir") {
      dirMetaByPath.set(d.relativePath, { documentId: d.documentId, displayName: d.displayName });
    }
  }

  const sortedDocs = [...docs]
    .filter((d) => (d.fileType ?? "md") !== "dir")
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  for (const doc of sortedDocs) {
    const segments = doc.relativePath.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    const leaf = segments[segments.length - 1]!;
    const dirSegs = segments.slice(0, -1);

    let currentPath = "";
    let parentNodes: TreeNode[] = root;

    for (const part of dirSegs) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folderNode = folderMap.get(currentPath);
      if (!folderNode) {
        const meta = dirMetaByPath.get(currentPath);
        folderNode = {
          type: "folder",
          name: part,
          path: currentPath,
          documentId: meta?.documentId ?? `folder-${currentPath}`,
          children: [],
        };
        const dn = meta?.displayName?.trim();
        if (dn) folderNode.folderDisplayName = dn;
        parentNodes.push(folderNode);
        folderMap.set(currentPath, folderNode);
      } else {
        const meta = dirMetaByPath.get(currentPath);
        if (meta) {
          folderNode.documentId = meta.documentId;
          const dn = meta.displayName.trim();
          if (dn) folderNode.folderDisplayName = dn;
        }
      }
      parentNodes = folderNode.children;
    }

    if (leaf.toLowerCase() === FOLDER_DESC_FILENAME.toLowerCase()) {
      const folderNode = folderMap.get(currentPath);
      if (folderNode) {
        folderNode.descDocumentId = doc.documentId;
        const dn = doc.displayName.trim();
        if (dn) folderNode.folderDisplayName = dn;
      }
      continue;
    }

    parentNodes.push({
      type: "document",
      name: leaf,
      path: doc.relativePath,
      documentId: doc.documentId,
      displayName: doc.displayName || leaf.replace(/\.md$/i, ""),
      ownerVisitorId: doc.ownerVisitorId,
      updatedAt: doc.updatedAt,
    });
  }

  return root;
}
