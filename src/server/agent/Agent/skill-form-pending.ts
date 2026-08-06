import { randomUUID } from "node:crypto";
import { DEFAULT_CHOICE_TIMEOUT_MS } from "./choice-pending.js";

export type SkillFormWaitResult =
  | {
      status: "submitted";
      name: string;
      description: string;
      body: string;
    }
  | { status: "timeout" }
  | { status: "cancelled" };

type PendingEntry = {
  visitorId: string;
  resolve: (result: SkillFormWaitResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();

export { DEFAULT_CHOICE_TIMEOUT_MS as DEFAULT_SKILL_FORM_TIMEOUT_MS };

export function waitForSkillForm(params: {
  visitorId: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): { requestId: string; promise: Promise<SkillFormWaitResult> } {
  const requestId = randomUUID();
  const timeoutMs = Math.min(
    Math.max(params.timeoutMs ?? DEFAULT_CHOICE_TIMEOUT_MS, 3_000),
    300_000,
  );

  const promise = new Promise<SkillFormWaitResult>((resolve) => {
    const finish = (result: SkillFormWaitResult) => {
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

export function resolveSkillForm(
  visitorId: string,
  requestId: string,
  fields: { name: string; description: string; body: string },
): SkillFormWaitResult {
  const entry = pending.get(requestId);
  if (!entry) throw new Error("skill_form_not_found");
  if (entry.visitorId !== visitorId) throw new Error("skill_form_forbidden");
  const result: SkillFormWaitResult = {
    status: "submitted",
    name: fields.name,
    description: fields.description,
    body: fields.body,
  };
  entry.resolve(result);
  return result;
}

export function expireSkillForm(visitorId: string, requestId: string): void {
  const entry = pending.get(requestId);
  if (!entry) throw new Error("skill_form_not_found");
  if (entry.visitorId !== visitorId) throw new Error("skill_form_forbidden");
  entry.resolve({ status: "timeout" });
}

export function cancelVisitorSkillForms(visitorId: string): void {
  for (const [id, entry] of pending) {
    if (entry.visitorId === visitorId) {
      entry.resolve({ status: "cancelled" });
      if (pending.has(id)) {
        clearTimeout(entry.timer);
        pending.delete(id);
      }
    }
  }
}
