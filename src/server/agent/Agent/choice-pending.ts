import { randomUUID } from "node:crypto";

export type ChoiceWaitResult =
  | { status: "selected"; choice: string }
  | { status: "timeout" }
  | { status: "cancelled" };

type PendingEntry = {
  visitorId: string;
  resolve: (result: ChoiceWaitResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();

/** 默认 2 分钟，给用户留思考时间 */
export const DEFAULT_CHOICE_TIMEOUT_MS = 120_000;

/** 登记一次 choice 等待；超时 / abort 会自动解冻 */
export function waitForUserChoice(params: {
  visitorId: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): { requestId: string; promise: Promise<ChoiceWaitResult> } {
  const requestId = randomUUID();
  const timeoutMs = Math.min(
    Math.max(params.timeoutMs ?? DEFAULT_CHOICE_TIMEOUT_MS, 3_000),
    300_000,
  );

  const promise = new Promise<ChoiceWaitResult>((resolve) => {
    const finish = (result: ChoiceWaitResult) => {
      const cur = pending.get(requestId);
      if (!cur) return;
      clearTimeout(cur.timer);
      pending.delete(requestId);
      resolve(result);
    };

    const timer = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    pending.set(requestId, {
      visitorId: params.visitorId,
      resolve: finish,
      timer,
    });

    const onAbort = () => finish({ status: "cancelled" });
    if (params.signal) {
      if (params.signal.aborted) {
        onAbort();
        return;
      }
      params.signal.addEventListener("abort", onAbort, { once: true });
    }
  });

  return { requestId, promise };
}

/** 前端点选 / 自由输入后解冻；choice 为内容字符串 */
export function resolveUserChoice(
  visitorId: string,
  requestId: string,
  choice: string,
): ChoiceWaitResult {
  const entry = pending.get(requestId);
  if (!entry) throw new Error("choice_not_found");
  if (entry.visitorId !== visitorId) throw new Error("choice_forbidden");
  const text = choice.trim();
  if (!text) throw new Error("choice_empty");
  const result: ChoiceWaitResult = { status: "selected", choice: text };
  entry.resolve(result);
  return result;
}

/** 前端倒计时结束解冻为 timeout */
export function expireUserChoice(visitorId: string, requestId: string): void {
  const entry = pending.get(requestId);
  if (!entry) throw new Error("choice_not_found");
  if (entry.visitorId !== visitorId) throw new Error("choice_forbidden");
  entry.resolve({ status: "timeout" });
}

/** 用户主动取消选择卡 */
export function cancelUserChoice(visitorId: string, requestId: string): void {
  const entry = pending.get(requestId);
  if (!entry) throw new Error("choice_not_found");
  if (entry.visitorId !== visitorId) throw new Error("choice_forbidden");
  entry.resolve({ status: "cancelled" });
}

/** chat 断开时清掉该访客未完成的 choice */
export function cancelVisitorChoices(visitorId: string): void {
  for (const [id, entry] of pending) {
    if (entry.visitorId === visitorId) {
      entry.resolve({ status: "cancelled" });
      // resolve 内会 delete；若竞态仍在则强制删
      if (pending.has(id)) {
        clearTimeout(entry.timer);
        pending.delete(id);
      }
    }
  }
}
