/**
 * 把表情包目录拼成 system prompt 的一段。
 *
 * Agent 不认识图片，只认识 [meme:<id>] 这个占位符；这里只给它「id + 语义描述」，
 * 让它能按场景挑。图库为空则返回空串（提示词体积不变）。
 */
import { listMemes } from "./store";

/** 列这么多条足够挑，再多就是白烧 token */
const MAX_LISTED = 60;

export function buildMemeCatalogSection(visitorId: string): string {
  const all = listMemes(visitorId);
  if (all.length === 0) return "";
  const listed = all.slice(0, MAX_LISTED);
  const lines = [
    "可用表情包（在正文里写 [meme:<id>] 即可发图，前端会渲染成图片；不要输出 Markdown 图片，也不要自己编 id）：",
    ...listed.map((m) => `- [meme:${m.id}] ${m.desc}`),
  ];
  if (all.length > listed.length) {
    lines.push(`（另有 ${all.length - listed.length} 张未列出，请只用上面出现过的 id）`);
  }
  lines.push(
    "",
    "使用规则：",
    "1. 只在闲聊、收尾、情绪到位（开心/吐槽/安慰/打招呼）时用；写步骤、解释报错、给方案时不要用。",
    "2. 一条消息最多 5 张；分散在合适位置即可，不要无意义刷屏。",
    "3. id 必须来自上面的列表；宁可不发，也不要编造。",
  );
  return lines.join("\n");
}
