import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100 selection:bg-emerald-500">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-rose-500/30 shadow-2xl space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-400 w-16 h-16 flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {this.props.fallbackTitle || "Something went wrong"}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {this.props.fallbackMessage ||
                  "An unexpected interface error occurred. You can safely reload the page to restore your workspace."}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left overflow-x-auto max-h-32">
                <p className="text-[11px] font-mono text-rose-300">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload EKCTC Finance</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
