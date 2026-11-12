/**
 * 端到端：真实 xlsx → prepareUserTurn → session 工具行。
 * 只验证「首轮注入 + 落盘行」的形状，不碰 DB（store 用内存假实现）。
 */
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { prepareUserTurn } from "./prepare-turn.js";
import type { AttachmentStore } from "./store.js";
import type { AssetMeta } from "./types.js";
import { ATTACHMENT_READ_TOOL } from "./session-rows.js";

function makeXlsx(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["订单号", "金额", "状态"],
    ["A001", 120, "已发货"],
    ["A002", 88, "待付款"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "差异明细");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buf);
}

function fakeStore(files: Record<string, { meta: AssetMeta; data: Uint8Array }>): AttachmentStore {
  return {
    async saveStaging() {
      throw new Error("unused");
    },
    async persist(input) {
      return input.ids.map((id) => {
        const f = files[id];
        if (!f) throw new Error("attachment_not_found");
        return f.meta;
      });
    },
    async read(input) {
      const f = files[input.id];
      if (!f) throw new Error("attachment_not_found");
      return f;
    },
    async purgeExpiredStaging() {
      return 0;
    },
  };
}

const meta = (id: string, name: string, bytes: number): AssetMeta => ({
  id,
  sessionId: "s1",
  ownerVisitorId: "v1",
  sha256: "x",
  name,
  mime: "application/octet-stream",
  bytes,
  status: "persisted",
  createdAt: new Date().toISOString(),
});

describe("prepareUserTurn 附件落盘", () => {
  it("小 Excel：解析结果进 prompt，同时落一条带正文的 tool 行", async () => {
    const data = makeXlsx();
    const m = meta("a1", "report.xlsx", data.byteLength);
    const result = await prepareUserTurn({
      store: fakeStore({ a1: { meta: m, data } }),
      visitorId: "v1",
      sessionId: "s1",
      message: "看下差异",
      assetIds: ["a1"],
    });

    // 首轮：模型直接看到表格
    expect(result.pi.text).toContain("差异明细");
    expect(result.pi.text).toContain("A001");

    // 落盘：一条 tool 行，参数记录 assetId
    expect(result.toolRows).toHaveLength(1);
    const row = result.toolRows[0]!;
    expect(row.toolName).toBe(ATTACHMENT_READ_TOOL);
    expect(row.arguments).toEqual({ assetId: "a1" });
    expect(row.resultText).toContain("差异明细");
    expect(row.resultText).toContain("A002");
    expect(row.isError).toBeUndefined();
  });

  it("图片：不落字节，只落一句带 assetId 的调用提示", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const m = meta("img1", "shot.png", png.byteLength);
    const result = await prepareUserTurn({
      store: fakeStore({ img1: { meta: m, data: png } }),
      visitorId: "v1",
      sessionId: "s1",
      message: "这张图",
      assetIds: ["img1"],
    });

    // 首轮仍走多模态
    expect(result.pi.images).toHaveLength(1);
    expect(result.pi.images[0]?.mimeType).toBe("image/png");

    // 落盘只有提示
    const row = result.toolRows[0]!;
    expect(row.resultText).toContain("图片附件未内嵌");
    expect(row.resultText).toContain(ATTACHMENT_READ_TOOL);
    expect(row.resultText).toContain('"assetId": "img1"');
    // 不能把 base64 落进 session
    expect(row.resultText).not.toContain("iVBOR");
  });

  it("小文件但解析超长：落预览而不是整段，且能说清怎么续读", async () => {
    // 造一张行数很多的表：文件只有几十 KB，展开成 JSON 却远超 20,000 字符
    const wb = XLSX.utils.book_new();
    const rows: Array<[number, string, number]> = [];
    for (let i = 0; i < 2000; i++) rows.push([i, `订单${i}`, i * 13.5]);
    const ws = XLSX.utils.aoa_to_sheet([["序号", "名称", "金额"], ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "明细");
    const buf = new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);

    const m = meta("big1", "big.xlsx", buf.byteLength);
    const result = await prepareUserTurn({
      store: fakeStore({ big1: { meta: m, data: buf } }),
      visitorId: "v1",
      sessionId: "s1",
      message: "看下",
      assetIds: ["big1"],
    });

    // 文件字节数远低于 1MB
    expect(buf.byteLength).toBeLessThan(1024 * 1024);

    const row = result.toolRows[0]!;
    // 关键：不是「正文未内嵌」那句空话，而是带真实预览
    expect(row.resultText).toContain("仅落预览");
    expect(row.resultText).toContain('"assetId": "big1"');
    expect(row.resultText).toContain("offset/limit");
    // 预览里应能看到表头
    expect(row.resultText).toContain("序号");
    // 不能把整份 32 万级字符塞进 session
    expect(row.resultText.length).toBeLessThan(60_000);
  });
});
