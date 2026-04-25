import { useEffect, useRef, useState, useCallback } from "react";
import type { Position } from "./diagramUtils";
import { identifyChartBlock, calculateToolbarPosition } from "./diagramUtils";

export interface ToolbarState {
  isVisible: boolean;
  activeBlock: Element | null;
  position: Position | null;
}

export interface UseToolbarOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isLocked: boolean;
  onToolbarVisibleChange?: (visible: boolean) => void;
}

/**
 * Hook for managing toolbar visibility and positioning.
 */
export function useToolbar(options: UseToolbarOptions) {
  const { containerRef, isLocked, onToolbarVisibleChange } = options;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toolbarState, setToolbarState] = useState<ToolbarState>({
    isVisible: false,
    activeBlock: null,
    position: null,
  });

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  /**
   * Shows the toolbar at the block's position.
   */
  const showToolbar = useCallback((block: Element) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const position = calculateToolbarPosition(block);
    setToolbarState({
      isVisible: true,
      activeBlock: block,
      position,
    });
  }, []);

  /**
   * Hides the toolbar after a short delay.
   */
  const hideToolbar = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setToolbarState((prev) => {
        if (prev.isVisible && onToolbarVisibleChange) {
          onToolbarVisibleChange(false);
        }
        return {
          isVisible: false,
          activeBlock: null,
          position: null,
        };
      });
    }, 120);
  }, [onToolbarVisibleChange]);

  /**
   * Cancels pending hide operation.
   */
  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  /**
   * Updates toolbar position when viewport changes.
   */
  const handleViewportChange = useCallback(() => {
    setToolbarState((prev) => {
      if (prev.activeBlock && prev.activeBlock.isConnected) {
        return {
          ...prev,
          position: calculateToolbarPosition(prev.activeBlock),
        };
      }
      return {
        ...prev,
        isVisible: false,
        position: null,
      };
    });
  }, []);

  /**
   * Handles mouse over event on chart blocks.
   */
  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const block = identifyChartBlock(e.target, container);
      if (block) {
        showToolbar(block);
      }
    },
    [containerRef, showToolbar],
  );

  /**
   * Handles mouse out event on chart blocks.
   */
  const handleMouseOut = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const block = identifyChartBlock(e.target, container);
      if (!block) return;

      const to = e.relatedTarget as Node | null;
      // Don't hide if moving to toolbar
      if (to && document.querySelector(".chart-hover-actions")?.contains(to)) {
        return;
      }
      hideToolbar();
    },
    [containerRef, hideToolbar],
  );

  // Set up viewport change listeners
  useEffect(() => {
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [handleViewportChange]);

  // Notify on visibility change
  useEffect(() => {
    if (onToolbarVisibleChange) {
      onToolbarVisibleChange(toolbarState.isVisible);
    }
  }, [toolbarState.isVisible, onToolbarVisibleChange]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return {
    toolbarState,
    showToolbar,
    hideToolbar,
    cancelHide,
    handleMouseOver,
    handleMouseOut,
    handleViewportChange,
    isLocked: isLockedRef.current,
  };
}
