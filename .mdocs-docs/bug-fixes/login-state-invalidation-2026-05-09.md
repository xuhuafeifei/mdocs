# 登录态失效 BUG 修复记录

## 现象

刷新页面后有时会需要重新登录，明明 Cookie 里有 token 却认证失败。

## 根因

`client.ts` 把 localStorage 里的 `"cookie"` 字符串（占位符）放到了请求头 `x-visitor-token` 中，而后端认证中间件**优先读取请求头**，读到了无效的 `"cookie"` 字符串，覆盖了真正有效的 Cookie 认证。

### 错误链路

1. `App.tsx` - 登录成功后执行 `storeIdentity(visitorId, "cookie")`，把 token 存成了字符串 `"cookie"`
2. `client.ts` - API 请求时从 localStorage 读出 `"cookie"`，放到 `x-visitor-token` 请求头
3. `auth.middleware.ts` - 优先读请求头，得到无效的 `"cookie"`，认证失败
4. 真正有效的 token 在 HttpOnly Cookie 里，但被请求头的值给"覆盖"了

## 修复

### 第一阶段（快速修复）

- `client.ts` - 请求头设置前增加判断：`token.length > 20` 才设置请求头
- 避免 `"cookie"` 占位符污染请求头

### 第二阶段（彻底清理）

- 完全删除 localStorage 存 token 的逻辑
- 删除 `getStoredToken` 函数
- 删除 `client.ts` 中所有手动设置 `x-visitor-token` 的代码
- 认证完全依赖 HttpOnly Cookie

## 涉及文件

- `src/web/services/client.ts` - 删除 token 存储和读取逻辑
- `src/web/app/App.tsx` - 清理 import
- `src/web/app/VisitorRegisterDialog.tsx` - 清理 import
- `src/web/services/endpoints.ts` - 清理 upload 接口的 token header

## 经验教训

1. **不要在多个地方做同一件事** - 认证应该只有一个通道（Cookie），不要同时走请求头 + Cookie
2. **占位符有风险** - 存 `"cookie"` 这种假值不如不存
3. **优先顺序要谨慎** - 中间件的 fallback 顺序可能导致难以排查的 bug
