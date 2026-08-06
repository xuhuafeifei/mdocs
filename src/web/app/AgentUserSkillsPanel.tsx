import { useEffect, useRef, useState } from "react";
import {
  createAgentUserSkillApi,
  deleteAgentUserSkillApi,
  fetchAgentUserSkillsApi,
  updateAgentUserSkillApi,
  type AgentUserSkill,
} from "../services/endpoints";

const NAME_RE = /^[A-Za-z0-9_]+$/;

function isValidSkillName(name: string): boolean {
  return NAME_RE.test(name.trim());
}

/**
 * 设置页：私人 Agent skill CRUD（与 AI 配置同页，独立卡片区）。
 */
export function AgentUserSkillsPanel() {
  const mountedRef = useRef(true);
  const [skills, setSkills] = useState<AgentUserSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAgentUserSkillsApi();
      if (!mountedRef.current) return;
      setSkills(list);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setName("");
    setDescription("");
    setBody("");
    setError(null);
  }

  function startEdit(s: AgentUserSkill) {
    setCreating(false);
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description);
    setBody(s.body);
    setError(null);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setBody("");
  }

  async function onSave() {
    const trimmed = name.trim();
    if (!isValidSkillName(trimmed)) {
      setError("名称仅允许英文、数字、下划线");
      return;
    }
    if (!body.trim()) {
      setError("正文不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        await createAgentUserSkillApi({ name: trimmed, description, body });
      } else if (editingId) {
        await updateAgentUserSkillApi(editingId, {
          name: trimmed,
          description,
          body,
        });
      }
      if (!mountedRef.current) return;
      cancelForm();
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("删除该 Skill？已引用的历史轮次将跳过缺失项。")) return;
    setError(null);
    try {
      await deleteAgentUserSkillApi(id);
      if (!mountedRef.current) return;
      if (editingId === id) cancelForm();
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const formOpen = creating || editingId !== null;
  const nameOk = !name.trim() || isValidSkillName(name);

  return (
    <div className="mdocs-settings mdocs-agent-skills-panel">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">
          Agent Skills
          {!loading && skills.length > 0 ? (
            <span className="mdocs-agent-skills-count">{skills.length}</span>
          ) : null}
        </h2>
        {!formOpen ? (
          <button type="button" className="secondary" onClick={startCreate}>
            新建
          </button>
        ) : null}
      </div>

      <div className="mdocs-settings-cards">
        <div className="mdocs-settings-card">
          <p className="mdocs-settings-item-desc mdocs-agent-skills-lead">
            私人提示词宏。名称对本账号唯一，仅英文、数字、下划线；智能助手 / 帮写里按名称引用。
          </p>

          {error ? <p className="mdocs-agent-skills-error">{error}</p> : null}

          {formOpen ? (
            <div className="mdocs-agent-skills-form">
              <div className="mdocs-agent-skills-form-head">
                <strong>{creating ? "新建 Skill" : "编辑 Skill"}</strong>
              </div>
              <label className="mdocs-agent-skills-field">
                <span>名称</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={64}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="e.g. weekly_report"
                  className={nameOk ? undefined : "mdocs-agent-skills-input-invalid"}
                />
                {!nameOk ? (
                  <span className="mdocs-agent-skills-hint-bad">
                    仅允许 A–Z、a–z、0–9、_
                  </span>
                ) : (
                  <span className="mdocs-agent-skills-hint">引用与索引键，保存后按此名称使用</span>
                )}
              </label>
              <label className="mdocs-agent-skills-field">
                <span>简介（可选）</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  placeholder="一句话说明用途"
                />
              </label>
              <label className="mdocs-agent-skills-field">
                <span>正文</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  placeholder="写入 Agent 应遵守的步骤与约束…"
                />
              </label>
              <div className="mdocs-agent-config-actions">
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving || !nameOk || !name.trim() || !body.trim()}
                >
                  {saving ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={cancelForm}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {loading ? <p className="mdocs-settings-item-desc">加载中…</p> : null}

          {!loading && skills.length === 0 && !formOpen ? (
            <div className="mdocs-agent-skills-empty">
              <p>还没有 Skill</p>
              <button type="button" className="secondary" onClick={startCreate}>
                新建第一个
              </button>
            </div>
          ) : null}

          {!loading && skills.length > 0 ? (
            <ul className="mdocs-agent-skills-list">
              {skills.map((s) => {
                const valid = isValidSkillName(s.name);
                const active = editingId === s.id;
                return (
                  <li
                    key={s.id}
                    className={
                      "mdocs-agent-skills-item" +
                      (active ? " mdocs-agent-skills-item-active" : "")
                    }
                  >
                    <div className="mdocs-agent-skills-item-main">
                      <div className="mdocs-agent-skills-item-title-row">
                        <code className="mdocs-agent-skills-name">{s.name}</code>
                        {!valid ? (
                          <span
                            className="mdocs-agent-skills-badge-warn"
                            title="名称含非法字符，请编辑改为英文数字下划线"
                          >
                            需改名
                          </span>
                        ) : null}
                      </div>
                      <span className="mdocs-agent-skills-desc">
                        {s.description.trim() || "无简介"}
                      </span>
                    </div>
                    <div className="mdocs-agent-skills-item-actions">
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => startEdit(s)}
                        disabled={formOpen && !active}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => void onDelete(s.id)}
                        disabled={formOpen}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
