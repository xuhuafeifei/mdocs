/** Same rules as server `normaliseDocRelativePath` (no Node `path` dependency). */

export class DocPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocPathError";
  }
}

const RELATIVE_PATH_RX = /^[A-Za-z0-9_\-./\u4e00-\u9fa5]+$/;

function posixNormalize(raw: string): string {
  const stack: string[] = [];
  for (const seg of raw.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (stack.length) stack.pop();
    } else stack.push(seg);
  }
  return stack.join("/");
}

export function normaliseDocRelativePath(input: string): string {
  const raw = input.trim();
  if (!raw) throw new DocPathError("relative path is required");
  if (raw.startsWith("/")) throw new DocPathError("path must be relative");
  if (raw.includes("\\")) throw new DocPathError("use forward slashes");
  if (raw.includes("..")) throw new DocPathError("path must not contain ..");
  if (!raw.toLowerCase().endsWith(".md")) {
    throw new DocPathError("document path must end with .md");
  }
  if (!RELATIVE_PATH_RX.test(raw)) {
    throw new DocPathError("path contains unsupported characters");
  }
  const norm = posixNormalize(raw);
  if (norm.startsWith("..") || norm.startsWith("/")) {
    throw new DocPathError("path escapes docs root");
  }
  return norm;
}
