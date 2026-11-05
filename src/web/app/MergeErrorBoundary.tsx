import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onError?: (message: string) => void;
  onClose?: () => void;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

/** 合并页懒加载 / Lexical 桥出错时不要把整棵 React 卸成 #root:empty。 */
export class MergeErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error.message || String(error));
    console.error("[MergeErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mdocs-merge-overlay" role="alert">
        <header className="mdocs-merge-toolbar">
          <div className="mdocs-merge-toolbar-title">
            <h2>{this.props.fallbackTitle ?? "合并失败"}</h2>
          </div>
          <div className="mdocs-merge-toolbar-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                this.setState({ error: null });
                this.props.onClose?.();
              }}
            >
              关闭
            </button>
          </div>
        </header>
        <div className="mdocs-merge-body">
          <p className="mdocs-merge-loading">
            {this.state.error.message || "合并视图出错，请关闭后重试。"}
          </p>
        </div>
      </div>
    );
  }
}
