/**
 * React Error Boundary component
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="card border-[var(--signal-collapse)] m-6">
          <h2 className="font-serif text-lg uppercase tracking-wide mb-4 text-[var(--signal-collapse)]">System Error</h2>
          {this.state.error && (
            <p className="font-mono text-sm opacity-80 mb-4 leading-relaxed">
              {this.state.error.message}
            </p>
          )}
          {process.env.NODE_ENV === "development" && this.state.errorInfo && (
            <details className="text-xs font-mono mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer opacity-60 uppercase tracking-wider mb-2">Stack Trace</summary>
              <pre className="mt-3 overflow-auto opacity-50 text-[10px] leading-tight">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            className="mt-6 btn border-[var(--signal-collapse)] hover:bg-[var(--signal-collapse)] hover:text-background"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

