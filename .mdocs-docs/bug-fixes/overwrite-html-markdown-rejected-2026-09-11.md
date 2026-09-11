# overwrite-html-markdown-rejected-2026-09-11

> 一句话：Ask 覆写 `untitled.html` 时误传 Markdown 格式被 400；现对 html 原样写入 HTML。

## 现象
用户让 Ask 往空的 HTML 文档写示例。工具失败后助手声称「overwrite_document 不支持写 HTML」，并绕去建议新建 Markdown / 让用户手贴。

## 根因
1. `updateDocument` 按契约拒绝 html + `contentFormat=markdown`（html 只存原文）。
2. `overwrite_document` 曾无条件传 `contentFormat: "markdown"`。
3. 工具描述 / system prompt 只说「完整 Markdown」，助手读手册后把 400 理解成「产品不支持」，再违反「改正文必须 overwrite、禁止自拟绕道选项」去出选择卡。

## 方案
- html（`writeNormalize=raw`）：覆写时省略 `contentFormat`，`content` 必须是 HTML 原文。
- md：仍传 `contentFormat=markdown`。
- 工具描述与 Ask 规则写明：按 `fileType` 传对应格式，禁止声称无法写 HTML。
- `get_document` 返回 `fileType`；`create_document` 可建 html；`list_tree` 改读 `treeIncludeTypes()`。

## 涉及文件
| 路径 | 符号 | 说明 |
|------|------|------|
| `src/server/agent/Agent/tools-overwrite.ts` | `doOverwrite` | html 省略 markdown 格式 |
| `src/server/agent/Agent/system-prompt.ts` | `NORMAL_RULES` | html 传 HTML 原文 |
| `src/server/agent/Agent/tools-documents.ts` | `getDocumentTool` `createDocumentTool` `listTreeTool` | fileType / 建 html / 树含 html |
| `src/server/documents/document.service.ts` | `updateDocument` | html 禁 markdown 转 |

## 验证
- `pnpm vitest run src/server/agent/Agent/tools-overwrite.test.ts src/server/agent/Agent/tools-documents.get-document.test.ts`
