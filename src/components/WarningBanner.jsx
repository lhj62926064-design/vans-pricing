/**
 * WarningBanner.jsx - 규칙 위반 경고 배너
 *
 * violations 배열이 비어있지 않으면 상단에 빨간 경고 배너를 표시합니다.
 * Monotonic Discount Rule 위반 내역을 리스트로 보여줍니다.
 */

export default function WarningBanner({ violations }) {
  if (!violations || violations.length === 0) return null;

  return (
    <div
      className="mb-4 p-4 rounded-lg border-2 shadow-sm animate-pulse-slow print:animate-none"
      style={{
        backgroundColor: '#fef2f2',
        borderColor: 'var(--color-warning)',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-sm mb-1"
            style={{ color: 'var(--color-warning)' }}
          >
            Monotonic Discount Rule 위반 감지!
          </h3>
          <p className="text-xs text-red-600 mb-2">
            수량이 증가하면 단가가 반드시 내려가야 합니다. 아래 항목을 확인하세요.
          </p>
          <ul className="space-y-1">
            {violations.map((msg, idx) => (
              <li
                key={idx}
                className="text-xs text-red-700 flex items-start gap-1"
              >
                <span className="shrink-0 mt-0.5">•</span>
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
