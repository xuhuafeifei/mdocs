# 018 — 插件 CLI：用 cwd / 假 HOME 控落盘，不用 env「魔法」

- **状态**：accepted（2026-10-31）
- **上下文**：Skill + CLI 插件（如 `python3 scripts/foo.py config set`）需要在受管目录跑脚本。曾讨论注入 `MDOCS_PLUGIN_HOME` / `MDOCS_PLUGIN_DATA`，但**脚本不会自动读这些变量**；若误以为「设了 env 就改写路径」，会高估隔离能力。同时第三方 skill 常写死 `~/.xxx`。
- **选项**：
  1. **只设 env**：约定脚本读 `MDOCS_PLUGIN_*`。合约 skill 可用；写死 `~` / 绝对路径的完全无效。
  2. **OS 沙箱 / FS hook**：强隔离，实现与运维成本高，本期不做。
  3. **cwd + 假 HOME + 可选 env**：`spawn(..., { shell: false, cwd })`；`HOME`/`USERPROFILE` 指到同一目录；另附 `MDOCS_PLUGIN_HOME`/`DATA` 给主动读变量的脚本；args 禁绝对路径/`~`/`..`。
- **决策**：采用 **3**。
  - 相对路径写入 → 落在 `plugins-home/<name>/` 或 `cwd_root=data` 时的 `tenant/.../plugins-data/<name>/`。
  - `~/...` / `$HOME/...` → 被假 HOME 拐进上述目录。
  - `MDOCS_PLUGIN_*` → **约定信号，非强制拦截**；未读则无效果。
  - 写死 `/tmp/...`、`/Users/...` 等绝对路径 → **控不住**；不合约，编排时改写或拒装。
- **后果**：
  - ✅ 实现轻；覆盖「相对路径 + 家目录习惯」两类常见写法。
  - ⚠️ 不是沙箱；绝对路径仍可逃逸。Agent / 流水线工具层继续拒绝对路径参数。
  - ⚠️ 假 HOME 可能影响依赖「真用户家目录」的工具（罕见）；白名单 CLI 已限制面。
- **落点**：
  | 位置 | 说明 |
  |------|------|
  | `src/server/plugins/plugin-cli.ts` | `runPluginCli`：白名单、相对路径校验、cwd、假 HOME、env |
  | `src/server/agent/Agent/tools-plugin-cli.ts` | `run_plugin_cli` / `list_plugin_home` / `query_skill` |
  | `.mdocs-docs/.../设计契约-目录统一.md` | Skill + CLI 路径节 |
- **回退**：去掉假 HOME 只保留 cwd + 合约 env；第三方 `~` skill 会立刻写回真家目录。
