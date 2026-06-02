/**
 * 自动保存 Hook
 * 监听 Lexical 编辑器内容变化，在以下时机自动将草稿保存到 IndexedDB：
 * 1. 内容变更后防抖（默认 1s）
 * 2. 编辑器失去焦点（blur）
 * 3. 页面隐藏/关闭（visibilitychange / beforeunload）
 * 使用 markdown 作为内容对比基线，避免 Lexical 内部状态（node key）抖动导致误保存。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { IEditor } from "@lobehub/editor";
import { getDocumentTaskQueue } from "../documentTaskQueue";
import { deleteDraft, getDraft, upsertContentDraft } from "../../storage/drafts";

interface UseAutoSaveOptions {
  editor: IEditor | null;
  documentId: string;
  displayName: string;
  debounceMs?: number;
  /** When false, skip Lexical listeners (e.g. read-only). */
  enabled?: boolean;
  /** 开编时服务端 head；仅在该 documentId 尚无草稿时写入 localBaseCommitId */
  localBaseCommitIdAtEditStart?: string | null;
  /** 首次创建草稿时一并落盘的文档 meta 快照 */
  snapshotMeta?: {
    relativePath: string;
    permission: number;
    ownerVisitorId: string;
    domainId: string;
  };
}

const MAX_DATASOURCE_WAIT_FRAMES = 48;

function safeGetMarkdown(editor: IEditor): string | null {
  try {
    const raw = editor.getDocument("markdown");
    return typeof raw === "string" ? raw : "";
  } catch {
    return null;
  }
}

function safeGetJsonString(editor: IEditor): string | null {
  try {
    return JSON.stringify(editor.getDocument("json"));
  } catch {
    return null;
  }
}

export function useAutoSave({
  editor,
  documentId,
  displayName,
  debounceMs = 1000,
  enabled = true,
  localBaseCommitIdAtEditStart,
  snapshotMeta,
}: UseAutoSaveOptions) {
  // ---- 状态：内容是否有未保存的变更 ----
  const [isDirty, setIsDirty] = useState(false);

  // ---- 状态：IndexedDB 中是否已有该文档的草稿 ----
  const [draftExists, setDraftExists] = useState(false);

  // ---- 状态：上次保存的时间戳 ----
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // ---- 防抖定时器引用 ----
  // 用于延迟保存，避免用户连续输入时频繁写入 IndexedDB
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 清理函数引用 ----
  // 存储 Lexical 监听器的注销函数，在依赖变化时清理旧监听器
  const cleanupRef = useRef<(() => void) | null>(null);

  // ---- 草稿是否最新标记 ----
  // true = IndexedDB 草稿与当前编辑器内容一致
  // false = 内容已变更，草稿已过时
  const draftCurrentRef = useRef(false);

  /**
   * 上次保存/加载时的编辑器内容快照，用于过滤掉 Lexical 的非内容更新（选区、光标移动等）。
   * 存储 markdown 而非 JSON，因为 JSON 包含 Lexical 内部状态（node key 等），
   * 编辑器挂载/初始化时 node key 会重新生成导致 JSON 变化，但文章实际内容没变。
   */
  const lastContentRef = useRef("");

  // ---- dirty 标记的 ref 版本 ----
  // 用于事件处理器中读取最新值（避免闭包捕获旧值）
  const dirtyRef = useRef(false);

  // ---- 使用 ref 保存频繁变化的值，避免 performSave 依赖变化导致监听器反复注册 ----
  const documentIdRef = useRef(documentId);
  const displayNameRef = useRef(displayName);
  const headAtEditStartRef = useRef(localBaseCommitIdAtEditStart);
  const snapshotMetaRef = useRef(snapshotMeta);
  documentIdRef.current = documentId;
  displayNameRef.current = displayName;
  headAtEditStartRef.current = localBaseCommitIdAtEditStart;
  snapshotMetaRef.current = snapshotMeta;

  /**
   * 执行实际保存：将当前编辑器内容序列化为 JSON 写入 IndexedDB。
   * 保存成功后同步更新 dirty、draftExists、lastSavedAt 等状态。
   * 注意：此函数仅依赖 editor（通过 ref 访问其他值），因此引用稳定，不会导致监听器反复注册。
   */
  const performSave = useCallback(async () => {
    // 编辑器尚未初始化，无法保存
    if (!editor) return;
    // 基线还没初始化（非空 markdown 字符串不会为 falsy），兜底跳过，防止挂载时误写草稿
    if (!lastContentRef.current) {
      console.log("[useAutoSave] performSave blocked: lastContentRef is empty");
      return;
    }
    // 将编辑器当前内容序列化为 Lexical JSON 字符串
    const jsonContent = safeGetJsonString(editor);
    if (jsonContent == null) return;
    console.log("[useAutoSave] performSave saving draft, documentId:", documentIdRef.current, "content preview:", jsonContent.slice(0, 80));
    await getDocumentTaskQueue(documentIdRef.current).execute(() =>
      upsertContentDraft({
        documentId: documentIdRef.current,
        content: jsonContent,
        displayName: displayNameRef.current,
        localBaseCommitIdAtEditStart: headAtEditStartRef.current,
        snapshotMeta: snapshotMetaRef.current,
      }),
    );
    // 保存成功后，用当前 markdown 内容更新对比基线
    lastContentRef.current = safeGetMarkdown(editor) ?? lastContentRef.current;
    // 标记草稿已存在（用于 UI 显示保存状态点）
    setDraftExists(true);
    // 清除 dirty 标记（内容已保存）
    setIsDirty(false);
    // 记录保存时间
    setLastSavedAt(Date.now());
    // 标记草稿与当前内容一致
    draftCurrentRef.current = true;
    dirtyRef.current = false;
  }, [editor]);

  /**
   * 切换文档时检查 IndexedDB 中是否已有草稿，恢复对应状态。
   */
  useEffect(() => {
    // 用于防止组件卸载后执行 setState
    let cancelled = false;
    // 从 IndexedDB 读取该文档的草稿
    getDraft(documentId).then((draft) => {
      // 如果组件已卸载，忽略结果
      if (cancelled) return;
      if (draft) {
        // 有草稿：更新 UI 状态，标记草稿存在
        setDraftExists(true);
        setLastSavedAt(draft.updatedAt);
        draftCurrentRef.current = true; // draft matches loaded state
      } else {
        // 无草稿：重置所有状态
        setDraftExists(false);
        setLastSavedAt(null);
        draftCurrentRef.current = false;
        dirtyRef.current = false;
      }
    });
    // 清理函数：组件卸载或 documentId 变化时标记为已取消
    return () => { cancelled = true; };
  }, [documentId]);

  /**
   * 注册 Lexical 更新监听器（afterDelay 模式）。
   * 以 markdown 为内容对比基线，仅在文本真正变化时才标记 dirty 并启动防抖保存。
   */
  useEffect(() => {
    if (!enabled) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      return;
    }
    // 编辑器尚未初始化，无法注册监听器
    if (!editor) return;
    // 获取 Lexical 内部编辑器实例
    const lexical = editor.getLexicalEditor();
    if (!lexical) return;

    // 先清理上一个编辑器实例的监听器（防止依赖变化时重复注册）
    cleanupRef.current?.();

    let cancelled = false;
    let raf = 0;
    let waitFrames = 0;

    const attachListener = () => {
      if (cancelled) return;
      const md = safeGetMarkdown(editor);
      if (md === null) {
        waitFrames += 1;
        if (waitFrames > MAX_DATASOURCE_WAIT_FRAMES) return;
        raf = requestAnimationFrame(attachListener);
        return;
      }
      lastContentRef.current = md;

      // 注册 Lexical 更新监听器：每次编辑器状态变化时都会触发
      const unregister = lexical.registerUpdateListener(() => {
        // 获取当前编辑器内容的 markdown 表示
        const nextMd = safeGetMarkdown(editor);
        if (nextMd === null) return;
        // 仅在文档文本实际变化时才标记 dirty。忽略选区/光标移动，以及 Lexical 内部状态抖动（node key 重新生成等）
        if (nextMd === lastContentRef.current) return;
        console.log("[useAutoSave] updateListener dirty, documentId:", documentId, "oldLen:", lastContentRef.current.length, "newLen:", nextMd.length);
        // 更新对比基线为最新内容
        lastContentRef.current = nextMd;

        // 标记内容已变更
        setIsDirty(true);
        dirtyRef.current = true;
        // 内容变了，草稿不再是最新的
        draftCurrentRef.current = false; // content changed, draft is now stale

        // 清除之前的防抖定时器（如果用户连续输入，重新计时）
        if (timerRef.current) clearTimeout(timerRef.current);
        // 启动新的防抖定时器，延迟保存
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          performSave();
        }, debounceMs);
      });

      // 保存清理函数，供下次 effect 执行或组件卸载时调用
      cleanupRef.current = () => {
        unregister();
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    };

    queueMicrotask(() => {
      if (!cancelled) raf = requestAnimationFrame(attachListener);
    });

    // 清理函数：依赖变化时注销旧监听器
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupRef.current?.();
    };
  }, [enabled, editor, documentId, displayName, debounceMs, localBaseCommitIdAtEditStart, snapshotMeta, performSave]);

  /**
   * 编辑器失焦时立即保存（取消待执行的防抖定时器，若内容有变更则立即执行）。
   */
  useEffect(() => {
    if (!enabled) return;
    // 编辑器未初始化时不处理
    if (!editor) return;
    // 获取编辑器根 DOM 元素
    const rootElement = editor.getLexicalEditor()?.getRootElement();
    if (!rootElement) return;

    const handleBlur = () => {
      // 失焦时先取消待执行的防抖定时器（避免重复保存）
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // 如果内容有变更，立即执行保存
      if (dirtyRef.current) {
        performSave();
      }
    };

    // 监听编辑器根元素的 blur 事件
    rootElement.addEventListener("blur", handleBlur);
    // 清理函数：移除 blur 监听器
    return () => rootElement.removeEventListener("blur", handleBlur);
  }, [enabled, editor, performSave]);

  /**
   * 页面隐藏或关闭前若仍有未保存变更，立即触发保存。
   */
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      // 页面切换到后台（如切换 Tab、最小化）
      if (document.visibilityState === "hidden") {
        // 取消待执行的防抖定时器
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        // 如果有未保存变更，立即保存到 IndexedDB
        if (dirtyRef.current) {
          performSave();
        }
      }
    };

    const handleBeforeUnload = () => {
      // 浏览器关闭/刷新前
      if (dirtyRef.current) {
        // 取消待执行的防抖定时器
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        // 立即保存，防止数据丢失
        performSave();
      }
    };

    // 注册页面可见性变化监听器
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // 注册浏览器关闭/刷新监听器
    window.addEventListener("beforeunload", handleBeforeUnload);
    // 清理函数：移除监听器
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, performSave]);

  /**
   * 清除当前文档的本地草稿（通常在成功发布后调用）。
   */
  async function clearDraft(): Promise<void> {
    // 从 IndexedDB 删除该文档的草稿记录
    await deleteDraft(documentId);
    // 重置所有相关状态
    setDraftExists(false);
    setIsDirty(false);
    dirtyRef.current = false;
    draftCurrentRef.current = false;
    lastContentRef.current = "";
  }

  /**
   * 加载本地草稿内容（若存在）。App.tsx 优先在打开文档时使用此内容。
   */
  async function loadDraftContent(): Promise<string | null> {
    // 从 IndexedDB 读取草稿
    const draft = await getDraft(documentId);
    // 没有草稿则返回 null
    if (!draft) return null;
    // 返回草稿内容（Lexical JSON 字符串）
    return draft.content;
  }

  /**
   * 外部保存草稿后调用（如手动「保存草稿」按钮），同步更新所有状态为「已保存」。
   */
  function markDraftSaved(): void {
    // 标记草稿已存在
    setDraftExists(true);
    // 清除 dirty 标记
    setIsDirty(false);
    dirtyRef.current = false;
    // 记录保存时间
    setLastSavedAt(Date.now());
    // 标记草稿与当前内容一致
    draftCurrentRef.current = true;
    // 更新 markdown 对比基线为当前内容
    if (editor) {
      lastContentRef.current = safeGetMarkdown(editor) ?? "";
    }
  }

  // 返回外部需要的状态和方法
  return { isDirty, draftExists, lastSavedAt, clearDraft, loadDraftContent, markDraftSaved };
}
