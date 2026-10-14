const DOC_ID_IN_HREF =
  /(?:^|#\/|\/)doc\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** 从 #/doc/<id> 或带 origin 的同一哈希地址取出文档 id。 */
export function documentIdFromAgentHref(href: string | undefined): string | null {
  if (!href) return null;
  const raw = href.trim();
  let path = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      path = `${url.pathname}${url.hash}`;
    } catch {
      path = raw;
    }
  }
  return path.match(DOC_ID_IN_HREF)?.[1] ?? null;
}
