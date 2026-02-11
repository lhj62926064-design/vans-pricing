/**
 * PackageCard.jsx - 개별 패키지 카드 (인라인 편집 가능)
 *
 * 파싱된 패키지 하나를 표시하고, 가격/구성 수정 가능.
 * 할인율과 절약금액을 실시간 표시.
 */

import { useMemo } from 'react';
import { formatNumber } from '../../utils/pricing';
import { computePackageSummary } from '../../utils/packagePricing';

export default function PackageCard({ pkg, index, onChange, onRemove }) {
  const summary = useMemo(() => computePackageSummary(pkg), [pkg]);

  const handleNameChange = (value) => {
    onChange({ ...pkg, name: value });
  };

  const handlePriceChange = (value) => {
    onChange({ ...pkg, packagePrice: Number(value) || 0 });
  };

  const handleItemPrice = (idx, value) => {
    const items = [...pkg.items];
    items[idx] = { ...items[idx], individualPrice: Number(value) || 0 };
    onChange({ ...pkg, items });
  };

  const handleItemQty = (idx, value) => {
    const items = [...pkg.items];
    items[idx] = { ...items[idx], quantity: Math.max(1, Number(value) || 1) };
    onChange({ ...pkg, items });
  };

  const handleItemName = (idx, value) => {
    const items = [...pkg.items];
    items[idx] = { ...items[idx], procedureName: value };
    onChange({ ...pkg, items });
  };

  const removeItem = (idx) => {
    const items = pkg.items.filter((_, i) => i !== idx);
    onChange({ ...pkg, items });
  };

  const addItem = () => {
    const items = [...pkg.items, { procedureName: '', quantity: 1, individualPrice: 0, priceSource: 'manual' }];
    onChange({ ...pkg, items });
  };

  const hasAllPrices = pkg.items.every((item) => Number(item.individualPrice) > 0);
  const savingsPositive = summary.savingsAmount > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-100">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <input
          type="text"
          value={pkg.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="flex-1 min-w-0 text-sm font-bold text-gray-800 bg-transparent border-none
                     focus:outline-none focus:ring-0 placeholder-gray-400"
          placeholder="패키지명"
        />
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors text-sm font-bold shrink-0 px-1"
          title="패키지 삭제"
        >
          ×
        </button>
      </div>

      {/* 구성 시술 */}
      <div className="px-4 py-3 space-y-1.5">
        {pkg.items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={item.procedureName}
              onChange={(e) => handleItemName(idx, e.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded text-xs
                         focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="시술명"
            />
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemQty(idx, e.target.value)}
              min="1"
              className="w-12 px-1.5 py-1.5 border border-gray-200 rounded text-xs text-center
                         focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <span className="text-xs text-gray-400 shrink-0">회</span>
            <input
              type="number"
              value={item.individualPrice || ''}
              onChange={(e) => handleItemPrice(idx, e.target.value)}
              min="0"
              placeholder="정가"
              className={`w-24 px-2 py-1.5 border rounded text-xs text-right
                         focus:outline-none focus:ring-1 focus:ring-indigo-300
                         ${item.individualPrice > 0 ? 'border-gray-200' : 'border-orange-300 bg-orange-50'}`}
            />
            <span className="text-xs text-gray-400 shrink-0">원</span>
            {pkg.items.length > 1 && (
              <button
                onClick={() => removeItem(idx)}
                className="text-gray-300 hover:text-red-500 text-xs font-bold shrink-0"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addItem}
          className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          + 시술 추가
        </button>
      </div>

      {/* 가격 + 요약 */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">패키지 이벤트가</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={pkg.packagePrice || ''}
                onChange={(e) => handlePriceChange(e.target.value)}
                min="0"
                placeholder="자동 또는 직접 입력"
                className="w-full px-2.5 py-2 border border-indigo-300 rounded text-sm font-bold text-indigo-700
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              <span className="text-xs text-gray-500 shrink-0">원</span>
            </div>
          </div>

          {/* 요약 뱃지 */}
          {hasAllPrices && summary.totalRegularPrice > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-400">정가 {formatNumber(summary.totalRegularPrice)}원</div>
              {pkg.packagePrice > 0 && (
                <div className={`text-sm font-bold ${savingsPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {savingsPositive ? '-' : '+'}{formatNumber(Math.abs(summary.savingsAmount))}원
                  <span className="text-xs ml-0.5">({summary.savingsPercent}%)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 가격 미입력 경고 */}
        {!hasAllPrices && (
          <p className="text-xs text-orange-500 mt-2">
            일부 시술의 정가가 입력되지 않았습니다. 시술 라이브러리에 등록하거나 직접 입력하세요.
          </p>
        )}
      </div>
    </div>
  );
}
