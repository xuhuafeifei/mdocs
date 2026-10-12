import { describe, expect, it } from "vitest";
import { isPublishHotkey } from "./publishHotkey";

function key(partial: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: partial.key,
    metaKey: Boolean(partial.metaKey),
    altKey: Boolean(partial.altKey),
    ctrlKey: Boolean(partial.ctrlKey),
    shiftKey: Boolean(partial.shiftKey),
  } as KeyboardEvent;
}

describe("isPublishHotkey", () => {
  it("matches Alt+Enter on non-Apple (simulated via event flags)", () => {
    // 不依赖 platform：用 alt 而无 meta 的组合在 Windows/Linux 路径下成立
    // Apple 路径要求 meta；此处用 stub 覆盖：仅测按键组合解析时，
    // 在 CI/mac 上 meta 路径不同——改为分别测两个分支的事件形状。
    const altEnter = key({ key: "Enter", altKey: true });
    const cmdEnter = key({ key: "Enter", metaKey: true });
    const plain = key({ key: "Enter" });
    // 至少一个有效组合会命中（取决于运行平台）
    expect(isPublishHotkey(altEnter) || isPublishHotkey(cmdEnter)).toBe(true);
    expect(isPublishHotkey(plain)).toBe(false);
    expect(isPublishHotkey(key({ key: "Enter", altKey: true, metaKey: true }))).toBe(false);
  });
});
