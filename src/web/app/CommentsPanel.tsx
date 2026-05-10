import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";

export interface DocumentComment {
  commentId: string;
  documentId: string;
  visitorId: string;
  visitorName: string;
  parentId: string | null;
  replyToVisitorId: string | null;
  replyToVisitorName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
}

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

const API_BASE = "/api";

export function CommentsPanel({ documentId, visitorId, visitorName, documentOwnerId, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ commentId: string; visitorName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /** 判断是否可以删除某条评论：是评论作者 OR 是文档创建者 */
  function canDeleteComment(comment: DocumentComment): boolean {
    if (!visitorId) return false;
    return comment.visitorId === visitorId || documentOwnerId === visitorId;
  }

  // 加载评论
  useEffect(() => {
    loadComments();
  }, [documentId]);

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/documents/${documentId}/comments`);
      const json = await res.json();
      setComments(json.data.comments);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }

  // 提交评论
  async function handleSubmit() {
    if (!newComment.trim() || !visitorId) return;

    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          parentId: replyTo?.commentId || null,
          replyToVisitorId: replyTo
            ? comments.find((c) => c.commentId === replyTo.commentId)?.visitorId ?? null
            : null,
          replyToVisitorName: replyTo?.visitorName || null,
        }),
      });
      setNewComment("");
      setReplyTo(null);
      await loadComments();
    } finally {
      setSubmitting(false);
    }
  }

  // 删除评论
  async function handleDelete(commentId: string) {
    if (!confirm("确定删除这条评论？")) return;

    try {
      await fetch(`${API_BASE}/documents/${documentId}/comments/${commentId}`, {
        method: "DELETE",
      });
      await loadComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
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

  // 前端分组：根评论
  const rootComments = comments.filter((c) => !c.parentId && !c.isDeleted);
  // 获取某根评论的所有回复
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parentId === parentId && !c.isDeleted);

  return (
    <div className="mdocs-comments-panel">
      {/* 头部 */}
      <div className="mdocs-comments-header">
        <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={18} />
          评论 ({comments.filter(c => !c.isDeleted).length})
        </h3>
        <button type="button" onClick={onClose} className="mdocs-comments-close-btn">
          <X size={18} />
        </button>
      </div>

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
                    onClick={() => handleDelete(root.commentId)}
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
              {getReplies(root.commentId).length > 0 && (
                <div className="mdocs-comment-replies">
                  {getReplies(root.commentId).map((reply) => (
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
                            onClick={() => handleDelete(reply.commentId)}
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
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? `回复 ${replyTo.visitorName}...` : "发表评论..."}
            className="mdocs-comments-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
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
    </div>
  );
}
