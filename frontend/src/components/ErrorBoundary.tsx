import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    const key = `error_ack_${Date.now()}`;
    sessionStorage.setItem(key, '1');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'inherit', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '12px' }}>Что-то пошло не так</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            При загрузке страницы произошла ошибка.
          </p>
          {this.state.message && (
            <pre
              style={{
                maxWidth: '720px',
                margin: '0 auto 20px',
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '6px',
                textAlign: 'left',
                overflow: 'auto',
                fontSize: '12px',
                color: '#B83A3A',
              }}
            >
              {this.state.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderRadius: '6px',
              background: '#3f7dff',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
