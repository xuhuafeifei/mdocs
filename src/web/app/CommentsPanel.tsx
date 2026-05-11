import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { fetchCommentsApi, createCommentApi, deleteCommentApi, type CommentEntry } from "../services/endpoints";

export type DocumentComment = CommentEntry;

interface CommentsPanelProps {
  documentId: string;
  /** 当前访客 ID，未登录时为 undefined */
  visitorId?: string;
  /** 当前访客昵称 */
  visitorName?: string;
  /** 文档创建者 ID，文档创建者可以删除所有评论 */
  documentOwnerId?: string;
  onClose: () => void;
}

export function CommentsPanel({ documentId, visitorId, visitorName, documentOwnerId, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ commentId: string; visitorName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 判断是否可以删除某条评论：是评论作者 OR 是文档创建者 */
  function canDeleteComment(comment: DocumentComment): boolean {
    if (!visitorId) return false;
    return comment.visitorId === visitorId || documentOwnerId === visitorId;
  }

  /**
   * 按 parentId 分组评论，O(n) 单次遍历，避免每次渲染多次 filter
   */
  const { rootComments, repliesByParentId, totalCount } = useMemo(() => {
    const root: DocumentComment[] = [];
    const replies = new Map<string, DocumentComment[]>();
    let count = 0;

    for (const c of comments) {
      if (c.isDeleted) continue;
      count++;
      if (!c.parentId) {
        root.push(c);
      } else {
        if (!replies.has(c.parentId)) replies.set(c.parentId, []);
        replies.get(c.parentId)!.push(c);
      }
    }
    return { rootComments: root, repliesByParentId: replies, totalCount: count };
  }, [comments]);

  // 用于竞态保护：快速切换文档时丢弃旧请求的 setState
  const expectedDocumentIdRef = useRef(documentId);

  // 加载评论 + 清理状态
  useEffect(() => {
    expectedDocumentIdRef.current = documentId;
    setNewComment("");
    setReplyTo(null);
    setError(null);
    loadComments();
  }, [documentId]);

  async function loadComments() {
    const currentDocId = expectedDocumentIdRef.current;
    setLoading(true);
    try {
      const res = await fetchCommentsApi(documentId);
      if (expectedDocumentIdRef.current !== currentDocId) return;
      setComments(res.comments);
    } catch (err) {
      if (expectedDocumentIdRef.current !== currentDocId) return;
      setError("加载评论失败");
      console.error("Failed to load comments:", err);
    } finally {
      if (expectedDocumentIdRef.current === currentDocId) {
        setLoading(false);
      }
    }
  }

  // 提交评论
  async function handleSubmit() {
    if (!newComment.trim() || !visitorId) return;

    setSubmitting(true);
    setError(null);
    try {
      await createCommentApi(documentId, {
        content: newComment,
        parentId: replyTo?.commentId || null,
        replyToVisitorId: replyTo
          ? comments.find((c) => c.commentId === replyTo.commentId)?.visitorId ?? null
          : null,
        replyToVisitorName: replyTo?.visitorName || null,
      });
      setNewComment("");
      setReplyTo(null);
      await loadComments();
    } catch (err) {
      setError((err as Error).message || "发表失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  // 删除评论
  async function handleDelete(commentId: string) {
    setError(null);
    try {
      await deleteCommentApi(documentId, commentId);
      await loadComments();
    } catch (err) {
      setError((err as Error).message || "删除失败，请重试");
    } finally {
      setDeleteTarget(null);
    }
  }

  // 格式化相对时间
  function formatRelativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  }

  return (
    <div className="mdocs-comments-panel">
      {/* 头部 */}
      <div className="mdocs-comments-header">
        <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={18} />
          评论 ({totalCount})
        </h3>
        <button type="button" onClick={onClose} className="mdocs-comments-close-btn">
          <X size={18} />
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mdocs-comments-error">
          {error}
          <button type="button" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* 评论列表 */}
      <div className="mdocs-comments-list">
        {loading ? (
          <div className="mdocs-comments-empty">加载中...</div>
        ) : rootComments.length === 0 ? (
          <div className="mdocs-comments-empty">暂无评论，来发表第一条吧～</div>
        ) : (
          rootComments.map((root) => (
            <div key={root.commentId} className="mdocs-comment-root">
              {/* 根评论头部 */}
              <div className="mdocs-comment-header">
                <span className="mdocs-comment-avatar">
                  {root.visitorName.charAt(0).toUpperCase()}
                </span>
                <span className="mdocs-comment-author">{root.visitorName}</span>
                <span className="mdocs-comment-time">{formatRelativeTime(root.createdAt)}</span>
                {canDeleteComment(root) && (
                  <button
                    type="button"
                    className="mdocs-comment-delete"
                    onClick={() => setDeleteTarget(root.commentId)}
                    title="删除"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="mdocs-comment-content">{root.content}</div>

              {/* 只有登录用户能回复 */}
              {visitorId && (
                <button
                  type="button"
                  className="mdocs-comment-reply-btn"
                  onClick={() =>
                    setReplyTo({ commentId: root.commentId, visitorName: root.visitorName })
                  }
                >
                  回复
                </button>
              )}

              {/* 回复列表 - 面包屑样式 */}
              {(repliesByParentId.get(root.commentId) ?? []).length > 0 && (
                <div className="mdocs-comment-replies">
                  {(repliesByParentId.get(root.commentId) ?? []).map((reply) => (
                    <div key={reply.commentId} className="mdocs-comment-reply">
                      <div className="mdocs-comment-header">
                        <span className="mdocs-comment-avatar mdocs-comment-avatar-small">
                          {reply.visitorName.charAt(0).toUpperCase()}
                        </span>
                        <span className="mdocs-comment-author">{reply.visitorName}</span>
                        {reply.replyToVisitorName && (
                          <span className="mdocs-comment-reply-to">
                            回复 {reply.replyToVisitorName}
                          </span>
                        )}
                        <span className="mdocs-comment-time">
                          {formatRelativeTime(reply.createdAt)}
                        </span>
                        {canDeleteComment(reply) && (
                          <button
                            type="button"
                            className="mdocs-comment-delete"
                            onClick={() => setDeleteTarget(reply.commentId)}
                            title="删除"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="mdocs-comment-content">{reply.content}</div>
                      {/* 只有登录用户能回复 */}
                      {visitorId && (
                        <button
                          type="button"
                          className="mdocs-comment-reply-btn"
                          onClick={() =>
                            setReplyTo({ commentId: root.commentId, visitorName: reply.visitorName })
                          }
                        >
                          回复
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 评论输入框：只有登录用户能发表 */}
      {visitorId ? (
        <div className="mdocs-comments-input-wrapper">
          {replyTo && (
            <div className="mdocs-comment-reply-notice">
              <span>
                回复 <span className="mdocs-comment-reply-to-name">{replyTo.visitorName}</span>
              </span>
              <button type="button" onClick={() => setReplyTo(null)}>
                <X size={14} /> 取消
              </button>
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 512))}
            placeholder={replyTo ? `回复 ${replyTo.visitorName}...` : "发表评论..."}
            className="mdocs-comments-input"
            maxLength={512}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <div className={`mdocs-comments-char-count${newComment.length >= 460 ? " mdocs-char-count--warn" : ""}`}>
            {newComment.length}/512
          </div>
          <div className="mdocs-comments-input-actions">
            <button
              type="button"
              className="mdocs-btn-primary"
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? "发表中..." : "发表"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mdocs-comments-input-wrapper" style={{ textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>
            请先创建访客身份以发表评论
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <ConfirmDialog
          title="删除评论"
          message="确定要删除这条评论吗？"
          confirmLabel="删除"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
