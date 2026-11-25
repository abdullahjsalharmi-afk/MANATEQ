import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Shown instead of the broken screen. `retry` re-renders the children; `error` is what was thrown. */
  fallback: (retry: () => void, error: unknown) => ReactNode;
  /** Changing this value clears the error (e.g. the current route). */
  resetKey?: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
  error: unknown;
  key: string | undefined;
}

/** Keeps one broken screen from taking the whole app down. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, error: undefined, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { failed: true, error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { failed: false, error: undefined, key: props.resetKey };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen failed to render:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback(() => this.setState({ failed: false, error: undefined }), this.state.error);
    return this.props.children;
  }
}
