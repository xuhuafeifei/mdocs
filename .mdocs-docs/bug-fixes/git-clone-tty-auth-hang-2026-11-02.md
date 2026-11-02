# git_clone 交互要密码卡死安装

> 一句话：私仓 https clone 会向 `/dev/tty` 要 Username，安装任务一直挂起；禁止交互后快速失败。

## 现象

- 流水线 `git_clone` 内网 GitLab 私仓时，跑 mdocs 的 terminal 出现 `Username for 'https://…':`，网页侧长时间无结束。
- 访客无法在 UI 回答该提示。

## 根因

- `spawn` 虽 `stdio: ignore`，git 仍可打开 **`/dev/tty`** 做凭据交互。
- 超时仅 `child.kill()`（SIGTERM），且未杀进程组，`git-remote-https` 等子进程可能拖住。
- download：`AbortSignal` 只盖住 `fetch` 头，正文 `pipeline` 无 deadline 时也可能挂住。

## 方案

- `GIT_TERMINAL_PROMPT=0` + 清空 `credential.helper` + `GCM_INTERACTIVE=never`；仍继承 `process.env`。
- 允许 `https://` / `ssh://` / `git@host:path`；SSH 强制 `BatchMode=yes` + `StrictHostKeyChecking=accept-new`（服务器 `~/.ssh`）。
- 超时/取消：`detached` 进程组 + `SIGKILL`。
- download：同一 `AbortSignal` 覆盖响应体。
- 认证类错误附加提示：https token URL，或跑 mdocs 用户的非交互 SSH。

## 涉及文件

| 路径 | 说明 |
|------|------|
| `src/server/plugins/pipeline/executor.ts` | `gitNonInteractiveEnv` / `killProcessTree` / download signal |
| `src/server/plugins/pipeline/step-definitions.ts` | git_clone 文案 |
| `src/server/plugins/pipeline/executor.test.ts` | 禁交互快速失败 |

## 验证

- `pnpm vitest run src/server/plugins/pipeline/executor.test.ts`
- 手工：无凭证私仓安装应秒级失败并打出「禁止交互登录」类提示，terminal 不再停在 Username。
