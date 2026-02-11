/**
 * ResultTable.jsx - 결과 테이블 컴포넌트
 *
 * 역할:
 *   - 계산 결과를 테이블로 실시간 표시
 *   - 행 유형별 배경색 적용 (체험가/이벤트가/경쟁사/위반)
 *   - Monotonic Rule 위반 행 빨간 배경 + 펄스 애니메이션
 *   - 컬럼: 옵션 | 가격 | 단가 | 체험가대비 | 이벤트가대비 | 규칙체크
 */

import { formatNumber, getUnitLabel } from '../utils/pricing';

/**
 * 행 배경 스타일 결정
 * @param {object} row - 결과 행 데이터
 * @returns {string} CSS 클래스
 */
function getRowStyle(row) {
  if (row.violation) return 'row-warning';
  switch (row.rowType) {
    case 'trial':
      return 'row-trial';
    case 'event':
      return 'row-event';
    case 'competitor':
      return 'row-competitor';
    default:
      return '';
  }
}

/**
 * 할인율 표시 포맷
 * @param {number|null} rate
 * @returns {JSX.Element}
 */
function DiscountBadge({ rate }) {
  if (rate === null || rate === undefined) {
    return <span className="text-gray-300">-</span>;
  }

  const isPositive = rate > 0;
  const isNegative = rate < 0;
  const absRate = Math.abs(rate);

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold
        ${isPositive ? 'bg-green-100 text-green-700' : ''}
        ${isNegative ? 'bg-red-100 text-red-700' : ''}
        ${rate === 0 ? 'bg-gray-100 text-gray-500' : ''}`}
    >
      {isPositive && '▼ '}
      {isNegative && '▲ '}
      {absRate}%
    </span>
  );
}

/**
 * 경쟁사 가격 우위 표시
 * @param {number|null} advantage
 * @returns {JSX.Element}
 */
function AdvantageBadge({ advantage }) {
  if (advantage === null || advantage === undefined) {
    return null;
  }

  const isWinning = advantage > 0;

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold
        ${isWinning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
    >
      {isWinning ? '✓ ' : '✗ '}
      {Math.abs(advantage)}%
      {isWinning ? ' 저렴' : ' 비쌈'}
    </span>
  );
}

export default function ResultTable({ rows, type }) {
  if (!rows || rows.length === 0) return null;

  const unitLabel = getUnitLabel(type);
  const hasCompetitor = rows.some((r) => r.rowType === 'competitor');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2 px-3 font-semibold text-gray-600">옵션</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-600">가격</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-600">
              {unitLabel}
            </th>
            <th className="text-center py-2 px-3 font-semibold text-gray-600">
              체험가대비
            </th>
            <th className="text-center py-2 px-3 font-semibold text-gray-600">
              이벤트가대비
            </th>
            <th className="text-center py-2 px-3 font-semibold text-gray-600">규칙</th>
            {hasCompetitor && (
              <th className="text-center py-2 px-3 font-semibold text-gray-600">
                경쟁사 비교
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const styleClass = getRowStyle(row);
            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 transition-colors ${styleClass}`}
              >
                {/* 옵션 라벨 */}
                <td className="py-2.5 px-3 font-medium">
                  {row.rowType === 'trial' && (
                    <span style={{ color: 'var(--color-trial)' }}>● </span>
                  )}
                  {row.rowType === 'event' && (
                    <span style={{ color: 'var(--color-event)' }}>● </span>
                  )}
                  {row.rowType === 'competitor' && (
                    <span style={{ color: 'var(--color-competitor)' }}>● </span>
                  )}
                  {row.violation && <span className="text-red-600">⚠ </span>}
                  {row.label}
                </td>

                {/* 가격 */}
                <td className="py-2.5 px-3 text-right font-mono">
                  {row.price > 0 ? `${formatNumber(row.price)}원` : '-'}
                </td>

                {/* 단가 */}
                <td className="py-2.5 px-3 text-right font-mono">
                  {row.unitPrice > 0 ? `${formatNumber(row.unitPrice)}원` : '-'}
                </td>

                {/* 체험가 대비 할인율 */}
                <td className="py-2.5 px-3 text-center">
                  <DiscountBadge rate={row.discountFromTrial} />
                </td>

                {/* 이벤트가 대비 할인율 */}
                <td className="py-2.5 px-3 text-center">
                  <DiscountBadge rate={row.discountFromEvent} />
                </td>

                {/* 규칙 체크 */}
                <td className="py-2.5 px-3 text-center">
                  {row.rowType === 'competitor' ? (
                    <span className="text-gray-300">-</span>
                  ) : row.violation ? (
                    <span className="text-red-600 font-bold text-base">⚠</span>
                  ) : row.price > 0 ? (
                    <span style={{ color: 'var(--color-success)' }} className="font-bold text-base">✓</span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>

                {/* 경쟁사 비교 */}
                {hasCompetitor && (
                  <td className="py-2.5 px-3 text-center">
                    {row.rowType === 'competitor' ? (
                      <AdvantageBadge advantage={row.competitorAdvantage} />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
