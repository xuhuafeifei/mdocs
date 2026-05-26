# 文档收藏功能

> 本文档记录 mdocs 文档收藏功能的设计与实现。
> 功能发布时间：2026-05
> 涉及代码范围：后端数据库、路由层 + 前端组件层

---

## 功能概述

用户可以收藏感兴趣的文档，并在「我的收藏」列表中统一查看和管理。

### 核心特性

1. **收藏/取消收藏**：打开文档时，通过右上角菜单切换收藏状态
2. **收藏列表**：侧边栏底部入口，查看所有已收藏的文档
3. **已删除文档处理**：文档被删除后，收藏记录仍然保留，显示「已删除」标签，用户可手动清理
4. **权限隔离**：仅显示当前用户有权访问的文档（无权限的文档收藏会变灰但不消失）

---

## 后端实现

### 1. 数据库 Schema

**文件**：`src/server/db/schema.ts`

新增 `document_bookmarks` 表，存储用户-文档的收藏关系：

```sql
CREATE TABLE IF NOT EXISTS document_bookmarks (
  visitor_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (visitor_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_visitor ON document_bookmarks (visitor_id);
```

**设计说明**：
- 联合主键 `(visitor_id, document_id)` 确保同一用户对同一文档只能收藏一次
- `created_at` 记录收藏时间，用于列表按时间倒序排列

---

### 2. Repository 层

**文件**：`src/server/db/repositories/bookmark.repo.ts`

实现 4 个核心操作：

| 函数 | 说明 |
|------|------|
| `addBookmark(db, visitorId, documentId)` | 添加收藏 |
| `removeBookmark(db, visitorId, documentId)` | 取消收藏 |
| `isBookmarked(db, visitorId, documentId)` | 检查是否已收藏 |
| `listBookmarksByVisitor(db, visitorId)` | 获取用户所有收藏 |

**关键设计**：
- `listBookmarksByVisitor` 使用 `LEFT JOIN` 关联 `documents` 表
- 即使文档已被删除，收藏记录仍然返回，通过 `isDeleted: true` 标记
- `BookmarkWithDocument` 类型中所有文档字段均为可空（`| null`）

---

### 3. 路由层

**文件**：`src/server/routes/bookmarks.routes.ts`

4 个 API 端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/bookmarks` | 获取当前用户的收藏列表 |
| `GET` | `/api/bookmarks/:documentId` | 检查某文档是否已收藏 |
| `POST` | `/api/bookmarks/:documentId` | 添加收藏（需有读权限） |
| `DELETE` | `/api/bookmarks/:documentId` | 取消收藏（无需额外权限） |

**权限处理逻辑**：
- 拉取列表时：`isDeleted === true` 的记录直接保留；未删除的文档做权限校验，无权限的过滤掉
- 添加收藏时：必须有读权限才能收藏
- 取消收藏时：不做权限校验（允许用户清理历史收藏）

---

### 4. 路由注册

**文件**：`src/server/app.ts`

在应用中注册 bookmarks 路由：

```typescript
import { buildBookmarksRouter } from "./routes/bookmarks.routes.js";
// ...
app.use("/api/bookmarks", buildBookmarksRouter());
```

---

## 前端实现

### 1. API 封装

**文件**：`src/web/services/endpoints.ts`

新增类型和函数：

```typescript
export interface Bookmark {
  documentId: string;
  domainId: string | null;
  relativePath: string | null;
  displayName: string | null;
  ownerVisitorId: string | null;
  permission: number | null;
  createdAt: string | null;
  bookmarkedAt: string;
  isDeleted: boolean;
}

export function fetchBookmarksApi(): Promise<Bookmark[]>;
export function checkBookmarkApi(documentId: string): Promise<{ bookmarked: boolean }>;
export function addBookmarkApi(documentId: string): Promise<void>;
export function removeBookmarkApi(documentId: string): Promise<void>;
```

---

### 2. 文档编辑器 - 收藏入口

**文件**：`src/web/app/DocumentEditor.tsx`

收藏入口整合在**文档信息下拉菜单**中（右上角 ⋮ 按钮）：

```
┌──────────────────────────────────────────────┐
│ [标题输入框]  [域选择]            [发布] [⋮] │
└──────────────────────────────────────────────┘
                                              ↓
                                   ┌─────────────────┐
                                   │ ⭐ 取消收藏      │ ← 点击切换
                                   │ 修改权限         │
                                   └─────────────────┘
```

**核心状态**：
- `isBookmarked`：当前文档是否已收藏
- `bookmarkBusy`：接口请求中防抖
- `toggleBookmark()`：切换收藏状态的处理函数

**生命周期**：
- 文档切换时（`documentId` 变化）自动调用 `checkBookmarkApi` 刷新收藏状态

---

### 2.5 工具栏收藏状态按钮（2026-05-17 新增）

**文件**：`src/web/app/DocumentEditor.tsx`

**问题背景**：原来的收藏入口隐藏在下拉菜单中，用户无法直接看到当前文档的收藏状态，需要点开菜单才能知道。

**优化方案**：在**域选择下拉框右侧**新增收藏状态按钮，直接展示当前收藏状态。

**位置**：
```
┌─────────────────────────────────────────────────────────────────┐
│ [标题输入框]  [默认域 ▼]  ⭐已收藏     [发布] [删除] [💬] [⋮] │
└─────────────────────────────────────────────────────────────────┘
                          ↑
                    新增收藏按钮
```

**设计细节**：
- **图标**：使用 `Star` 图标（来自 `lucide-react`）
- **状态展示**：
  - 未收藏：空心星星，灰色文字
  - 已收藏：实心黄色星星（`#faad14`） + "已收藏"文字
- **Tooltip**：鼠标 hover 显示"收藏"或"取消收藏"
- **防抖**：`bookmarkBusy` 状态防止重复点击

**代码位置**：
- 导入 `Star` 图标：line 46
- 状态定义：`isBookmarked`, `bookmarkBusy`（line 210-211）
- 加载收藏状态：useEffect（line 168-176）
- 按钮渲染：JSX 中 `DomainSelect` 组件之后

**用户价值**：
- 一眼就能看到文档是否已收藏
- 一键切换收藏状态，操作成本降低
- 与文档信息菜单中的收藏状态同步

---

### 3. 设置页 - 我的收藏列表

**文件**：`src/web/app/App.tsx`

入口位置：侧边栏底部，访客头像和退出按钮之间

```
┌──────────────────┐
│    文档树...     │
├──────────────────┤
│ [头像] 访客昵称  │  ⭐  [退出]
└──────────────────┘
               ↑
          收藏列表入口
```

弹窗列表展示规则：
- 正常文档：可点击跳转，黑色文字
- 已删除文档：变灰（`opacity: 0.6`），显示红色「已删除」标签，不可点击跳转
- 每条收藏右侧有 ✕ 按钮，点击直接取消收藏（无需确认）

---

### 4. 国际化文案

**文件**：`src/web/i18n/types.ts` - 翻译键类型定义

**文件**：`src/web/i18n/locales/zh.ts` - 中文文案：
- `bookmark`: "收藏"
- `bookmarkAdd`: "添加收藏"
- `bookmarkRemove`: "取消收藏"
- `bookmarkTitle`: "我的收藏"
- `bookmarkEmpty`: "暂无收藏"

**文件**：`src/web/i18n/locales/en.ts` - 英文文案：
- `bookmark`: "Bookmarks"
- `bookmarkAdd`: "Add to bookmarks"
- `bookmarkRemove`: "Remove from bookmarks"
- `bookmarkTitle`: "My Bookmarks"
- `bookmarkEmpty`: "No bookmarks yet"

---

## 涉及文件完整清单

### 后端
- `src/server/db/schema.ts` - 数据库表定义
- `src/server/db/repositories/bookmark.repo.ts` - 收藏数据操作
- `src/server/routes/bookmarks.routes.ts` - API 路由
- `src/server/app.ts` - 路由注册

### 前端
- `src/web/services/endpoints.ts` - API 封装
- `src/web/app/DocumentEditor.tsx` - 编辑器收藏菜单
- `src/web/app/App.tsx` - 侧边栏收藏入口 + 收藏列表弹窗
- `src/web/i18n/types.ts` - 翻译键类型
- `src/web/i18n/locales/zh.ts` - 中文文案
- `src/web/i18n/locales/en.ts` - 英文文案

---

## 设计决策记录

### 决策 1：LEFT JOIN 还是 INNER JOIN？

**问题**：文档被删除后，收藏记录要不要保留？

**决策**：使用 LEFT JOIN，保留已删除文档的收藏记录

**原因**：
- 用户可能不知道文档被删了，收藏突然消失会困惑
- 显示「已删除」标签让用户知道发生了什么
- 提供取消收藏按钮让用户可以手动清理
- 未来可以做「恢复文档」或「彻底删除」的扩展

---

### 决策 2：收藏按钮放在工具栏还是下拉菜单？

**问题**：收藏是高频操作吗？

**决策**：放在 ⋮ 下拉菜单中，不占用主工具栏空间

**原因**：
- 收藏是低频操作（一篇文档只点一次），不值得占用宝贵的工具栏位置
- 工具栏已经有发布、删除等更核心的操作
- 放在信息菜单里逻辑合理（都是「文档属性」相关的操作）

---

## 测试覆盖

全部 123 个现有测试用例通过。收藏功能的测试用例可以后续补充：
- 收藏/取消收藏接口测试
- 已删除文档的收藏显示测试
- 权限过滤测试（无权限的文档不显示在收藏列表）

---

## BUG 修复记录

### 修复：设置页「我的收藏」显示域 ID 而不是域名称（2026-05-17）

**问题**：
- 收藏列表中「所属域」列直接显示 `domainId`（如 "default"），而不是用户可识别的域显示名称
- 同样问题影响「我的文章」列表的域列

**根因**：
- `Bookmark` 类型只有 `domainId` 字段，没有 `domainName`
- 后端接口只返回 `domainId`，前端没有域名称映射

**修复方案**：

**文件**：`src/web/app/SettingsPage.tsx`

1. 组件挂载时加载域列表：
```typescript
const [domains, setDomains] = useState<DomainSummary[]>([]);

useEffect(() => {
  fetchDomainsApi().then((doms) => {
    if (mountedRef.current) setDomains(doms);
  }).catch(() => {});
}, []);
```

2. 构建 ID → 名称的映射：
```typescript
const domainNameMap = new Map(domains.map((d) => [d.domainId, d.domainName]));
```

3. 表格中使用映射后的名称：
```tsx
<td>{bookmark.isDeleted ? (
  <span style={{ opacity: 0.6 }}>已删除</span>
) : (
  domainNameMap.get(bookmark.domainId || "") || bookmark.domainId || "—"
)}
</td>
```

4. 同样修复应用到「我的文章」列表的域列

**验证**：
- 收藏列表显示域的中文名称（如 "默认域"）而不是 "default"
- 域删除后降级显示 domainId
- 无域时显示占位符 "—"
