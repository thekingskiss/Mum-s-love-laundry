import { Component } from 'react';
import { AlertOctagon } from 'lucide-react';

// React only shows a blank page when a render error is uncaught — this
// makes crashes visible (with the actual error, in dev) instead of a
// silent white screen that gives no clue what went wrong.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught a render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
          <AlertOctagon className="text-red-500" size={40} />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            This page hit an unexpected error. Try reloading — if it keeps happening, let us know what you were doing.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-w-full overflow-auto rounded-lg bg-slate-900 p-4 text-left text-xs text-red-300">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
