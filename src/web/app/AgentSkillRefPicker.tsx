import { useEffect, useRef, useState } from "react";
import {
  fetchAgentUserSkillsApi,
  type AgentUserSkill,
} from "../services/endpoints";

const REF_MAX = 5;

/**
 * 对话输入区：点击后向上弹出 skill 列表（名 + 简介），多选；无 slash。
 * 选中值为 skill name（对本访客唯一）。
 */
export function AgentSkillRefPicker(props: {
  selectedNames: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const mountedRef = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const [skills, setSkills] = useState<AgentUserSkill[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchAgentUserSkillsApi();
        if (!mountedRef.current) return;
        setSkills(list);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = skills.filter((s) => props.selectedNames.includes(s.name));

  function toggle(name: string) {
    if (props.disabled) return;
    const set = new Set(props.selectedNames);
    if (set.has(name)) {
      set.delete(name);
    } else {
      if (set.size >= REF_MAX) return;
      set.add(name);
    }
    props.onChange([...set]);
  }

  if (skills.length === 0 && !error) {
    return null;
  }

  return (
    <div className="mdocs-agent-skill-ref" ref={rootRef}>
      <div className="mdocs-agent-skill-ref-bar">
        <div className="mdocs-agent-skill-ref-anchor">
          {open && skills.length > 0 ? (
            <div
              className="mdocs-agent-skill-popover"
              role="listbox"
              aria-label="选择 Skill"
            >
              <div className="mdocs-agent-skill-popover-hint">
                选择要引用的 Skill（最多 {REF_MAX} 个）
              </div>
              <ul className="mdocs-agent-skill-popover-list">
                {skills.map((s) => {
                  const on = props.selectedNames.includes(s.name);
                  const full = !on && props.selectedNames.length >= REF_MAX;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={
                          "mdocs-agent-skill-popover-item" +
                          (on ? " mdocs-agent-skill-popover-item-on" : "")
                        }
                        disabled={props.disabled || full}
                        onClick={() => toggle(s.name)}
                      >
                        <span className="mdocs-agent-skill-popover-check" aria-hidden>
                          {on ? "✓" : ""}
                        </span>
                        <span className="mdocs-agent-skill-popover-text">
                          <span className="mdocs-agent-skill-popover-name">{s.name}</span>
                          {s.description ? (
                            <span className="mdocs-agent-skill-popover-desc">
                              {s.description}
                            </span>
                          ) : (
                            <span className="mdocs-agent-skill-popover-desc mdocs-agent-skill-popover-desc-muted">
                              无简介
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            className={
              "mdocs-agent-skill-ref-toggle" +
              (open ? " mdocs-agent-skill-ref-toggle-open" : "")
            }
            disabled={props.disabled || skills.length === 0}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            title="引用 Skill"
          >
            Skill{selected.length > 0 ? ` · ${selected.length}` : ""}
          </button>
        </div>
        {selected.map((s) => (
          <button
            key={s.name}
            type="button"
            className="mdocs-agent-skill-chip mdocs-agent-skill-chip-on"
            disabled={props.disabled}
            onClick={() => toggle(s.name)}
            title="移除引用"
          >
            {s.name}
            <span aria-hidden> ×</span>
          </button>
        ))}
      </div>
      {error ? <p className="mdocs-agent-panel-status-warn">{error}</p> : null}
    </div>
  );
}
