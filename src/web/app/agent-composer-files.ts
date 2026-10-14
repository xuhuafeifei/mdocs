const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
  "application/json": ".json",
  "application/pdf": ".pdf",
};

/** 截图粘贴经常没有文件名。补上后缀，上传接口才能认出类型。 */
export function ensureUploadFileName(file: File, now = new Date()): File {
  const raw = file.name.trim();
  if (raw && /\.[A-Za-z0-9]{1,8}$/.test(raw)) return file;
  const ext = EXT_BY_MIME[file.type] ?? "";
  if (!ext) return file;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const base = raw.replace(/\.+$/, "") || `paste-${hh}${mm}${ss}`;
  return new File([file], `${base}${ext}`, { type: file.type });
}

/** 已占用则在扩展名前加 `_1`、`_2`。`image.png` 与 `image_1.png` 都在时，下一张是 `image_2.png`。 */
export function uniqueFileName(name: string, used: ReadonlySet<string>): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  let next = `${base}_${i}${ext}`;
  while (used.has(next)) {
    i += 1;
    next = `${base}_${i}${ext}`;
  }
  return next;
}

export function nameFilesForUpload(
  files: File[],
  existing: Iterable<string>,
  now = new Date(),
): File[] {
  const used = new Set(existing);
  return files.map((file) => {
    const named = ensureUploadFileName(file, now);
    const unique = uniqueFileName(named.name, used);
    used.add(unique);
    if (unique === named.name) return named;
    return new File([named], unique, { type: named.type });
  });
}

export function dataTransferHasFiles(data: DataTransfer | null): boolean {
  if (!data) return false;
  return Array.from(data.types).includes("Files");
}

/** 优先用 files；剪贴板截图有时只出现在 items 里。 */
export function filesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  if (data.files.length > 0) return Array.from(data.files);
  const out: File[] = [];
  const items = data.items;
  if (!items) return out;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  return out;
}
