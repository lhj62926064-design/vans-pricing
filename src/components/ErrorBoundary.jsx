/**
 * ErrorBoundary.jsx - React 에러 바운더리
 *
 * 하위 컴포넌트에서 에러 발생 시 전체 앱 크래시를 방지하고
 * 사용자에게 복구 옵션을 제공합니다.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClearAndReset = () => {
    try {
      localStorage.removeItem('vans-pricing-data');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6 max-w-md w-full text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              오류가 발생했습니다
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              예기치 않은 오류가 발생했습니다. 아래 버튼으로 복구를 시도해주세요.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-500 bg-red-50 rounded p-2 mb-4 break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                           hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={this.handleClearAndReset}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200
                           rounded-lg hover:bg-red-100 transition-colors"
              >
                데이터 초기화
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
