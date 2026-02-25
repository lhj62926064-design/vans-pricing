/**
 * PackageCard.jsx - 개별 패키지 카드 (인라인 편집 가능)
 *
 * 파싱된 패키지 하나를 표시하고, 가격/구성 수정 가능.
 * 시술명 입력 시 지점 수가에서 자동완성 드롭다운 표시.
 * 할인율과 절약금액을 실시간 표시.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { formatNumber } from '../../utils/pricing';
import { computePackageSummary } from '../../utils/packagePricing';

export default function PackageCard({ pkg, index, onChange, onRemove, onDuplicate, branchProcedures = [], activeBranch }) {
  const summary = useMemo(() => computePackageSummary(pkg), [pkg]);
  const [openPriceDropdown, setOpenPriceDropdown] = useState(null);

  // 시술명 자동완성 상태
  const [activeNameDropdown, setActiveNameDropdown] = useState(null);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const nameDropdownRef = useRef(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (activeNameDropdown === null) return;
    const handleClick = (e) => {
      if (nameDropdownRef.current && !nameDropdownRef.current.contains(e.target)) {
        setActiveNameDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeNameDropdown]);

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

  // 시술명 입력 + 자동완성 트리거
  const handleItemNameWithSearch = (idx, value) => {
    handleItemName(idx, value);
    setHighlightedIdx(-1);
    if (value.length >= 1 && branchProcedures.length > 0) {
      setActiveNameDropdown(idx);
    } else {
      setActiveNameDropdown(null);
    }
  };

  // 자동완성 항목 선택
  const selectBranchItem = (idx, bp) => {
    const items = [...pkg.items];
    items[idx] = {
      ...items[idx],
      procedureName: bp.name,
      individualPrice: bp.standardPrice,
      priceSource: 'branch',
      branchCategory: bp.category,
    };
    onChange({ ...pkg, items });
    setActiveNameDropdown(null);
    setHighlightedIdx(-1);
  };

  // 시술명 검색 (지점 수가에서)
  const findNameMatches = (query) => {
    if (!query || !branchProcedures.length) return [];
    const q = query.replace(/\s+/g, '').toLowerCase();
    if (q.length < 1) return [];
    return branchProcedures.filter((bp) => {
      const name = bp.name.replace(/\s+/g, '').toLowerCase();
      return name.includes(q);
    }).slice(0, 15);
  };

  // 키보드 네비게이션
  const handleNameKeyDown = (e, idx, matches) => {
    if (activeNameDropdown !== idx || matches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault();
      selectBranchItem(idx, matches[highlightedIdx]);
    } else if (e.key === 'Escape') {
      setActiveNameDropdown(null);
    }
  };

  const removeItem = (idx) => {
    const items = pkg.items.filter((_, i) => i !== idx);
    onChange({ ...pkg, items });
  };

  const addItem = () => {
    const items = [...pkg.items, { procedureName: '', quantity: 1, individualPrice: 0, priceSource: 'manual' }];
    onChange({ ...pkg, items });
  };

  const findBranchMatches = (procedureName) => {
    if (!procedureName || !branchProcedures.length) return [];
    const q = procedureName.replace(/\s+/g, '').toLowerCase();
    if (q.length < 2) return [];
    return branchProcedures.filter((bp) => {
      const name = bp.name.replace(/\s+/g, '').toLowerCase();
      return name.includes(q) || q.includes(name);
    }).slice(0, 10);
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
        {/* 메모 표시 */}
        {pkg.memo && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0 max-w-[120px] truncate" title={pkg.memo}>
            {pkg.memo}
          </span>
        )}
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="text-gray-400 hover:text-indigo-500 transition-colors text-sm shrink-0 px-1"
            title="패키지 복제"
          >
            &#x29C9;
          </button>
        )}
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors text-sm font-bold shrink-0 px-1"
          title="패키지 삭제"
        >
          &times;
        </button>
      </div>

      {/* 구성 시술 */}
      <div className="px-4 py-3 space-y-1.5">
        {pkg.items.map((item, idx) => {
          const priceMatches = findBranchMatches(item.procedureName);
          const isPriceOpen = openPriceDropdown === idx;
          const nameMatches = activeNameDropdown === idx ? findNameMatches(item.procedureName) : [];
          const isNameOpen = activeNameDropdown === idx && nameMatches.length > 0;

          return (
            <div key={idx} className="flex items-center gap-2 relative">
              {/* 시술명 + 자동완성 드롭다운 */}
              <div className="flex-1 min-w-0 relative" ref={isNameOpen ? nameDropdownRef : undefined}>
                <input
                  type="text"
                  value={item.procedureName}
                  onChange={(e) => handleItemNameWithSearch(idx, e.target.value)}
                  onFocus={() => {
                    if (item.procedureName.length >= 1 && branchProcedures.length > 0) {
                      setActiveNameDropdown(idx);
                      setHighlightedIdx(-1);
                    }
                  }}
                  onKeyDown={(e) => handleNameKeyDown(e, idx, nameMatches)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs
                             focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder={branchProcedures.length > 0 ? '시술명 검색...' : '시술명'}
                />

                {/* 자동완성 드롭다운 */}
                {isNameOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl
                                  max-h-56 overflow-y-auto w-full min-w-[300px]">
                    <div className="px-3 py-1.5 bg-indigo-50 border-b border-gray-200 text-[10px] font-medium text-indigo-600 sticky top-0">
                      {activeBranch} 수가표 검색 ({nameMatches.length}건)
                    </div>
                    {nameMatches.map((bp, mi) => (
                      <button
                        key={mi}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectBranchItem(idx, bp)}
                        className={`w-full px-3 py-2 text-left transition-colors
                                   flex items-center justify-between gap-2 text-xs border-b border-gray-50 last:border-b-0
                                   ${mi === highlightedIdx ? 'bg-indigo-100' : 'hover:bg-indigo-50'}`}
                      >
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="text-gray-700 font-medium">{bp.name}</span>
                          {bp.category && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">
                              {bp.category}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-indigo-700 shrink-0">
                          {formatNumber(bp.standardPrice)}원
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="number"
                value={item.quantity}
                onChange={(e) => handleItemQty(idx, e.target.value)}
                min="1"
                className="w-12 px-1.5 py-1.5 border border-gray-200 rounded text-xs text-center
                           focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
              <span className="text-xs text-gray-400 shrink-0">회</span>
              <div className="relative">
                <div className="flex items-center gap-0.5">
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
                  {priceMatches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpenPriceDropdown(isPriceOpen ? null : idx)}
                      className={`px-1 py-1.5 text-xs rounded transition-colors shrink-0
                        ${isPriceOpen ? 'text-indigo-700 bg-indigo-100' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      title={`${activeBranch || '지점'} 수가 선택`}
                    >
                      &#x25BC;
                    </button>
                  )}
                </div>
                {isPriceOpen && priceMatches.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg
                                  max-h-48 overflow-y-auto min-w-[220px]">
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                      {activeBranch} 수가표
                    </div>
                    {priceMatches.map((bp, mi) => (
                      <button
                        key={mi}
                        type="button"
                        onClick={() => {
                          handleItemPrice(idx, bp.standardPrice);
                          setOpenPriceDropdown(null);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-gray-700 truncate">{bp.name}</span>
                        <span className="font-bold text-indigo-700 shrink-0">{formatNumber(bp.standardPrice)}원</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {item.individualPrice > 0 && item.priceSource && item.priceSource !== 'manual' && (
                <span className={`text-[10px] leading-none px-1 py-0.5 rounded shrink-0 ${
                  item.priceSource === 'branch'
                    ? 'bg-teal-100 text-teal-700'
                    : item.priceSource === 'trial'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {item.priceSource === 'branch' ? '수가' : item.priceSource === 'trial' ? '1체' : '이벤트'}
                </span>
              )}
              <span className="text-xs text-gray-400 shrink-0">원</span>
              {pkg.items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  className="text-gray-300 hover:text-red-500 text-xs font-bold shrink-0"
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
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
            일부 시술의 정가가 입력되지 않았습니다. 시술명을 입력하면 수가표에서 자동 검색됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
