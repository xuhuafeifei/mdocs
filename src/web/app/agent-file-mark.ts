export type FileMarkKind = "image" | "pdf" | "md" | "txt" | "csv" | "json" | "html" | "sheet" | "file";

const LABEL: Record<FileMarkKind, string> = {
  image: "IMG",
  pdf: "PDF",
  md: "MD",
  txt: "TXT",
  csv: "CSV",
  json: "JSON",
  html: "HTM",
  sheet: "SHT",
  file: "FILE",
};

export function fileMarkLabel(kind: FileMarkKind): string {
  return LABEL[kind];
}

/** 用文件名后缀和 mime 判断类型标记。图片优先出缩略图，其余用色块。 */
export function fileMarkKind(name: string, mime = ""): FileMarkKind {
  const type = mime.toLowerCase();
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (type === "text/markdown" || ext === "md" || ext === "markdown") return "md";
  if (type === "text/csv" || ext === "csv") return "csv";
  if (type === "application/json" || ext === "json") return "json";
  if (type === "text/plain" || ext === "txt") return "txt";
  if (type === "text/html" || ext === "html" || ext === "htm") return "html";
  if (ext === "sheet") return "sheet";
  return "file";
}
