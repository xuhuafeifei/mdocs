import React from "react";
import type { Position } from "./diagramUtils";

export interface ActionBarProps {
  position: Position | null;
  isVisible: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isLocked?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const EDIT_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.811l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064l6.286-6.287Z"
    />
  </svg>
);

const DELETE_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675a.75.75 0 1 0-1.492.15l.66 6.6A1.75 1.75 0 0 0 5.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 0 0-1.492-.149l-.66 6.6a.25.25 0 0 1-.249-.225h-5.19a.25.25 0 0 1-.249-.225l-.66-6.6Z"
    />
  </svg>
);

/**
 * Floating action bar for chart block interactions.
 * Light/white theme styling.
 */
export const ActionBar: React.FC<ActionBarProps> = ({
  position,
  isVisible,
  onEdit,
  onDelete,
  isLocked = false,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (!isVisible || !position) {
    return null;
  }

  return (
    <div
      className="chart-hover-actions"
      style={{
        position: "fixed",
        zIndex: 1500,
        top: `${position.top}px`,
        left: `${position.left}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "4px",
        padding: "6px",
        background: "rgba(255, 255, 255, 0.95)",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        pointerEvents: "auto",
        backdropFilter: "blur(4px)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "4px",
          justifyContent: "flex-end",
        }}
      >
        {!isLocked && (
          <ActionButton
            icon={EDIT_ICON}
            title="Edit diagram"
            onClick={onEdit}
            color="#3b82f6"
          />
        )}
        {!isLocked && (
          <ActionButton
            icon={DELETE_ICON}
            title="Delete diagram"
            onClick={onDelete}
            color="#ef4444"
          />
        )}
      </div>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  color: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, title, onClick, color }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        padding: "0",
        border: "none",
        background: isHovered ? "#f3f4f6" : "transparent",
        color: color,
        cursor: "pointer",
        borderRadius: "6px",
        transition: "background-color 0.15s ease",
      }}
    >
      {icon}
    </button>
  );
};

export default ActionBar;
