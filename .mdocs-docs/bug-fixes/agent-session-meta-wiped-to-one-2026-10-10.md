# agent-session-meta-wiped-to-one — 2026-10-10

## 现象

智能助手历史会话「聊着聊着没了」；列表只剩当前/一条。用户误以为有自动清理。

## 根因

- **无自动清理**（onboarding-ai 契约：>30 天 GC 仅备忘未做）。
- `session.json` 无锁整文件覆盖；并发读改写丢更新；半截 JSON → `readMeta()===null` → 用空 `sessions` + 当前 id 写回，索引被重置。
- 正文 `*.jsonl` 仍在，仅索引丢失。

## 方案

见需求夹 `requirements/agent-session-meta-integrity/`（**设计契约草案**）：meta 锁 + 原子写 + 读失败从 jsonl 恢复；CLI `mdocs agent session repair`。

## 备注

修复实现曾先于契约同意落地，属流程违规；以该需求设计契约人审为准。
