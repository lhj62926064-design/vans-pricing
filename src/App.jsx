/**
 * App.jsx - 메인 앱 컴포넌트
 *
 * ErrorBoundary로 감싸서 에러 시 전체 크래시를 방지합니다.
 */

import MainApp from './components/MainApp';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

export default App;
