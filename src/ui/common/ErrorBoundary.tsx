import { Component, ErrorInfo, ReactNode, CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  /** Custom fallback — replaces the default card when provided. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const styles: Record<string, CSSProperties> = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0e17',
    color: '#FFFFFE',
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box',
  },
  icon: {
    fontSize: '40px',
    lineHeight: 1,
  },
  heading: {
    fontWeight: 700,
    fontSize: '20px',
    margin: 0,
    color: '#FFFFFE',
  },
  message: {
    color: 'rgba(255,255,254,0.55)',
    fontSize: '13px',
    margin: 0,
    textAlign: 'center',
    maxWidth: '360px',
    lineHeight: 1.5,
  },
  button: {
    marginTop: '8px',
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #E8A444, #D4903A)',
    border: '1px solid rgba(232,164,68,0.3)',
    borderRadius: '10px',
    color: '#FFFFFE',
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[guessNFT] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div style={styles.root}>
        <span style={styles.icon}>⚡</span>
        <h2 style={styles.heading}>Something went wrong</h2>
        <p style={styles.message}>
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          style={styles.button}
          onClick={() => window.location.reload()}
        >
          Restart game
        </button>
      </div>
    );
  }
}
