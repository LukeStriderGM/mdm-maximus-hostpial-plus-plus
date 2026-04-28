import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  stack: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", stack: "" };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Unknown rendering error";
    return { hasError: true, message, stack: "" };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught:", error, errorInfo);
    this.setState({ stack: errorInfo.componentStack || "" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-text">
          <h2 className="text-base font-semibold mb-2">UI Runtime Error</h2>
          <p className="text-text-secondary mb-3">
            A rendering error occurred. Refresh after fixes, or share this message for debugging.
          </p>
          <pre className="bg-surface border border-border rounded p-3 overflow-auto whitespace-pre-wrap">
            {this.state.message}
          </pre>
          {this.state.stack && (
            <pre className="mt-3 bg-surface border border-border rounded p-3 overflow-auto whitespace-pre-wrap text-xs text-text-secondary">
              {this.state.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
