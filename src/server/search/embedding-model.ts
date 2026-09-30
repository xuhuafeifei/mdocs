/**
 * 本地 nomic GGUF Embedding：异步确保模型文件、进程内单例 load、embed 文本。
 * 任一步失败仅记日志；调用方应把 null / 抛错当作「跳过语义」。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { useLogger } from "../logger/logger.js";

const log = useLogger("embedding-model");

/** 写死模型名与维数（契约） */
export const EMBEDDING_MODEL_FILENAME = "nomic-embed-text-v1.5.Q4_K_M.gguf";
export const EMBEDDING_DIM = 768;

/** HuggingFace 官方 resolve URL（契约：固定 URL，不绑可配置 CDN） */
const MODEL_DOWNLOAD_URL =
  "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf";

const DOC_PREFIX = "search_document: ";
const QUERY_PREFIX = "search_query: ";

type EmbeddingContext = {
  getEmbeddingFor(input: string): Promise<{ vector: readonly number[] | Float32Array }>;
};

let downloadLock: Promise<void> | null = null;
let loadPromise: Promise<EmbeddingContext | null> | null = null;
let ready = false;
/** 已判定不可用（缺依赖 / load 失败），本进程内不再重试 load */
let disabled = false;

/** 模型目录：MDOCS_EMBEDDING_DIR 或 ~/.fgbg/shared/embedding */
export function getEmbeddingModelDir(): string {
  const override = process.env.MDOCS_EMBEDDING_DIR?.trim();
  if (override) return path.resolve(override);
  return path.join(os.homedir(), ".fgbg", "shared", "embedding");
}

export function getEmbeddingModelPath(): string {
  return path.join(getEmbeddingModelDir(), EMBEDDING_MODEL_FILENAME);
}

export function isEmbeddingModelFilePresent(): boolean {
  try {
    const st = fs.statSync(getEmbeddingModelPath());
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/** 进程内是否已成功 load 过模型 */
export function isEmbeddingReady(): boolean {
  return ready && !disabled;
}

/**
 * 启动旁挂：缺文件则后台下载，再尝试 load。绝不阻塞 listen。
 * 就绪后补扫无向量块的文档。
 */
export function ensureLocalEmbeddingModel(): void {
  void (async () => {
    try {
      await ensureModelFileOnDisk();
      const ctx = await getEmbeddingContext();
      if (ctx) {
        const { backfillMissingEmbeddings } = await import("./document-index-manager.js");
        await backfillMissingEmbeddings();
      }
    } catch (err) {
      log.warn(
        "embedding model ensure failed: %s",
        err instanceof Error ? err.message : String(err),
      );
    }
  })();
}

async function ensureModelFileOnDisk(): Promise<void> {
  if (isEmbeddingModelFilePresent()) return;
  if (downloadLock) {
    await downloadLock;
    return;
  }
  downloadLock = downloadModelFile().finally(() => {
    downloadLock = null;
  });
  await downloadLock;
}

async function downloadModelFile(): Promise<void> {
  const dir = getEmbeddingModelDir();
  await fsp.mkdir(dir, { recursive: true });
  const dest = getEmbeddingModelPath();
  const tmp = `${dest}.partial`;

  log.info("embedding model missing; downloading %s → %s", MODEL_DOWNLOAD_URL, dest);

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(tmp);
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      file.close(() => {
        void fsp.unlink(tmp).catch(() => {});
      });
      reject(err);
    };

    const get = (url: string, redirectsLeft: number) => {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(url, (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 300 && code < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          get(res.headers.location, redirectsLeft - 1);
          return;
        }
        if (code !== 200) {
          fail(new Error(`download HTTP ${code}`));
          res.resume();
          return;
        }
        const total = Number(res.headers["content-length"] || 0);
        let received = 0;
        let lastPct = -1;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0) {
            const pct = Math.floor((received / total) * 100);
            if (pct >= lastPct + 5 || pct === 100) {
              lastPct = pct;
              log.info(
                "embedding download progress %d%% (%d / %d bytes)",
                pct,
                received,
                total,
              );
            }
          } else if (received % (8 * 1024 * 1024) < chunk.length) {
            log.info("embedding download progress %d bytes", received);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            if (settled) return;
            settled = true;
            resolve();
          });
        });
      });
      req.on("error", fail);
    };

    get(MODEL_DOWNLOAD_URL, 5);
  });

  await fsp.rename(tmp, dest);
  log.info("embedding model downloaded: %s", dest);
}

async function getEmbeddingContext(): Promise<EmbeddingContext | null> {
  if (disabled) return null;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!isEmbeddingModelFilePresent()) {
      ready = false;
      return null;
    }
    try {
      const { getLlama } = await import("node-llama-cpp");
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: getEmbeddingModelPath() });
      const embeddingContext = await model.createEmbeddingContext();
      ready = true;
      log.info("embedding model loaded (%s, dim=%d)", EMBEDDING_MODEL_FILENAME, EMBEDDING_DIM);
      return embeddingContext;
    } catch (err) {
      disabled = true;
      ready = false;
      log.warn(
        "embedding model load failed; semantic search disabled: %s",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  })();
  return loadPromise;
}

/**
 * 对文本做 embedding。kind 决定 nomic 任务前缀。
 * 不可用时返回 null；不向外抛。
 */
export async function embedText(
  text: string,
  kind: "document" | "query",
): Promise<Float32Array | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const ctx = await getEmbeddingContext();
    if (!ctx) return null;
    const prefix = kind === "query" ? QUERY_PREFIX : DOC_PREFIX;
    // 截断过长输入，避免撑爆 context
    const input = prefix + trimmed.slice(0, 6000);
    const emb = await ctx.getEmbeddingFor(input);
    const vec = emb.vector;
    if (!vec || vec.length === 0) return null;
    const out = Float32Array.from(vec);
    if (out.length !== EMBEDDING_DIM) {
      log.warn("unexpected embedding dim %d (expected %d)", out.length, EMBEDDING_DIM);
    }
    return out;
  } catch (err) {
    log.warn("embedText failed: %s", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** 测试用：重置进程内状态 */
export function __resetEmbeddingModelStateForTests(): void {
  downloadLock = null;
  loadPromise = null;
  ready = false;
  disabled = false;
}
