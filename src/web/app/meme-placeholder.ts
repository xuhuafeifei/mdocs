/**
 * 表情包占位符：[meme:<id>] → markdown 图片。
 *
 * 为什么在渲染层做：正文里存的是占位符文本，图片是「呈现」。
 * 这样历史消息、刷新、重启进程都不需要迁移数据，id 也在正文里，天然可重放。
 */

/** 全角半角都认：流式输出里 [ ／ ］ ／ ： 经常混着来 */
export const MEME_PLACEHOLDER_RE = /[[［]meme[:：]([A-Za-z0-9_-]{1,32})[\]］]/gi;

/** img 组件用它认领「这是表情包」 */
export const MEME_IMG_SRC_RE = /^\/api\/memes\/image\/([A-Za-z0-9_-]{1,32})$/;

export function memeImageSrc(id: string): string {
  return `/api/memes/image/${id}`;
}

/** 代码块 / 行内代码里不替换：那儿出现 meme 标记多半是在讲协议本身 */
export function renderMemePlaceholders(text: string): string {
  if (!text.includes("meme")) return text;
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(MEME_PLACEHOLDER_RE, (_all, id: string) => `![表情](${memeImageSrc(id)})`),
    )
    .join("");
}

export function memeIdFromSrc(src: string | undefined): string | null {
  if (!src) return null;
  const hit = MEME_IMG_SRC_RE.exec(src);
  return hit?.[1] ?? null;
}
