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
        <div className="border border-red-500 bg-red-500/10 p-4 m-4">
          <h2 className="text-red-500 font-bold mb-2">Something went wrong</h2>
          {this.state.error && (
            <p className="text-sm text-gray-300 mb-2">
              {this.state.error.message}
            </p>
          )}
          {process.env.NODE_ENV === "development" && this.state.errorInfo && (
            <details className="text-xs font-mono mt-2">
              <summary className="cursor-pointer text-gray-400">Stack trace</summary>
              <pre className="mt-2 overflow-auto text-gray-500">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

