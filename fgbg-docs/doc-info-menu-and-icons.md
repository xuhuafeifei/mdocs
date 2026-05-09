# 文档信息菜单与图标优化

## 1. 文档信息下拉菜单

**实现时间：** 2026-05-09

### 功能概述

在文档编辑器工具栏删除按钮右侧新增三条线图标按钮，点击展开文档信息下拉菜单。

### 菜单项布局

- **顶部元信息区**（4 行，左标签右值）
  - 创建者：显示访客昵称，fallback 显示 visitorId 前 8 位
  - 创建时间：本地化日期格式
  - 大小：文件体积（Blob size）
  - 上次编辑：本地化日期格式

- **分隔线**：1px 水平线

- **可点击操作区**（2 行）
  - 添加/取消收藏：根据当前收藏状态切换文本
  - 修改文章权限：预留功能，目前显示 alert 占位

### 交互细节

- 点击三条线按钮切换菜单显示/隐藏
- 点击菜单外部自动关闭
- hover 可点击行有浅灰色背景高亮效果
- 收藏图标 hover 有缩放效果

### 代码位置

- `src/web/app/DocumentEditor.tsx` - 菜单 UI 与状态管理
- `src/web/services/endpoints.ts` - 访客目录 API 复用

### i18n 翻译 Key

| Key | 中文 | 英文 |
|-----|------|------|
| `docInfoCreator` | 创建者 | Creator |
| `docInfoCreatedAt` | 创建时间 | Created |
| `docInfoSize` | 大小 | Size |
| `docInfoUpdatedAt` | 上次编辑 | Last edited |
| `docInfoChangePermission` | 修改文章权限 | Change permission |

---

## 2. Cookie 有效期优化

### 变更内容

将登录 Cookie 有效期从**1 年**延长到**10 年**，实践中等同于永久登录。

### 代码位置

- `src/server/routes/visitors.routes.ts` - `maxAge: 10 * 365 * 24 * 60 * 60 * 1000`

### 影响范围

- 新注册访客
- 使用恢复码恢复身份的访客

---

## 3. 书签功能权限检查修复

### 问题

书签路由 `getDomainInfo` 调用缺少 `visitorId` 参数，导致权限判断失效。

### 修复内容

1. **新增 `getDomainInfo` 辅助函数**
   - 位置：`src/server/access/access-control.ts`
   - 功能：根据 `domainId` + `visitorId` 获取域权限上下文（域类型 + 是否为成员）

2. **修正三处调用点**（`src/server/routes/bookmarks.routes.ts`）
   - 收藏列表过滤
   - 检查单篇文档收藏状态
   - 添加收藏前权限校验

### 额外优化

- 已删除文档的收藏保留显示（`isDeleted` 标记），允许用户手动取消收藏
- 无权限但未删除的文档也保留在列表中

---

## 4. Lucide 图标替换

### 替换清单

| 位置 | 原字符 | 新图标 | 尺寸 | 样式 |
|------|--------|--------|------|------|
| 侧边栏收藏按钮 | ⭐ | `<Star />` | 16px | 1.5px stroke |
| 侧边栏退出按钮 | ⏻ | `<LogOut />` | 16px | 1.5px stroke |
| 工具栏收藏按钮 | ⭐/☆ | `<Star />` | 18px | 已收藏：金色填充 `#eab308`，未收藏：muted 空心 |

### 代码位置

- `src/web/app/App.tsx` - 侧边栏图标
- `src/web/app/DocumentEditor.tsx` - 工具栏收藏按钮
- 文档信息菜单内收藏图标保持 emoji（保持简洁）

---

## 5. Hover 交互效果

### 侧边栏图标按钮

- CSS class：`.mdocs-sidebar-bookmark`、`.mdocs-sidebar-logout`
- 效果：hover 时颜色从 muted → text 原色 + 浅灰色背景
- 过渡动画：0.15s ease

### 工具栏收藏按钮

- CSS class：`.mdocs-bookmark-btn`
- 效果：hover 时 `transform: scale(1.1)` 轻微放大
- 过渡动画：0.15s ease

### 代码位置

- `src/web/app/App.css` - 末尾新增样式

---

## 6. Tooltip 国际化

### 新增翻译 Key

| Key | 中文 | 英文 |
|-----|------|------|
| `logout` | 退出登录 | Sign out |

### 应用位置

- 侧边栏退出登录按钮 tooltip
- 收藏按钮 tooltip 已复用 `bookmark` key

---

## 相关文件总览

```
src/server/
  access/access-control.ts         - 新增 getDomainInfo
  routes/visitors.routes.ts        - Cookie 有效期 10 年
  routes/bookmarks.routes.ts       - 权限检查参数修正

src/web/
  app/App.tsx                      - 图标替换、tooltip i18n
  app/App.css                      - Hover 效果样式
  app/DocumentEditor.tsx           - 文档信息菜单完整实现
  i18n/types.ts                    - 新增翻译 key 类型
  i18n/locales/zh.ts               - 中文翻译
  i18n/locales/en.ts               - 英文翻译
```
