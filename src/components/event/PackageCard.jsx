/**
 * PackageCard.jsx - 개별 패키지 카드 (인라인 편집 가능)
 *
 * 기능:
 *  - 접기/펼치기 (collapsed state)
 *  - 개별 시술 할인율 조절 → 패키지가 자동 계산
 *  - 패키지가 수동 입력 → 시술별 할인율 역산 표시
 *  - 시술별 기여도(절약 비율) 표시
 *  - 시술명 자동완성 (지점 수가 + 최근 사용)
 *  - 유사 수가표 항목 추천
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { formatNumber } from '../../utils/pricing';
import {
  computePackageSummary,
  calcPackagePriceFromItemDiscounts,
  reverseCalcItemDiscounts,
  findSimilarBranchItems,
} from '../../utils/packagePricing';

// 최근 사용 시술 로드
function loadRecentProcedures() {
  try {
    const raw = localStorage.getItem('vans-pricing-recent-procedures');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// 최근 사용 시술 저장
function saveRecentProcedure(proc) {
  try {
    let recent = loadRecentProcedures();
    // 중복 제거 후 앞에 추가
    recent = recent.filter((r) => r.name !== proc.name);
    recent.unshift({ name: proc.name, price: proc.standardPrice || proc.price || 0, category: proc.category || '' });
    if (recent.length > 10) recent = recent.slice(0, 10);
    localStorage.setItem('vans-pricing-recent-procedures', JSON.stringify(recent));
  } catch {}
}

export default function PackageCard({
  pkg,
  index,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  branchProcedures = [],
  activeBranch,
  roundUnit = 10000,
}) {
  const summary = useMemo(() => computePackageSummary(pkg), [pkg]);
  const reversedDiscounts = useMemo(() => reverseCalcItemDiscounts(pkg), [pkg]);
  const [collapsed, setCollapsed] = useState(false);
  const [openPriceDropdown, setOpenPriceDropdown] = useState(null);
  const [showContribution, setShowContribution] = useState(false);

  // 시술명 자동완성 상태
  const [activeNameDropdown, setActiveNameDropdown] = useState(null);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const nameDropdownRef = useRef(null);

  // 개별 할인율 모드 추적: 사용자가 개별 할인율을 수정했는지
  const [itemDiscountMode, setItemDiscountMode] = useState(false);

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
    const newPrice = Number(value) || 0;
    onChange({ ...pkg, packagePrice: newPrice });
    // 수동 입력 시 개별 할인율 모드 해제 (역산 모드로 전환)
    setItemDiscountMode(false);
  };

  const handleItemPrice = (idx, value) => {
    const items = [...pkg.items];
    items[idx] = { ...items[idx], individualPrice: Number(value) || 0 };
    const updated = { ...pkg, items };
    // 개별 할인율 모드일 때 패키지가 재계산
    if (itemDiscountMode) {
      updated.packagePrice = calcPackagePriceFromItemDiscounts(updated, roundUnit);
    }
    onChange(updated);
  };

  const handleItemQty = (idx, value) => {
    const items = [...pkg.items];
    items[idx] = { ...items[idx], quantity: Math.max(1, Number(value) || 1) };
    const updated = { ...pkg, items };
    if (itemDiscountMode) {
      updated.packagePrice = calcPackagePriceFromItemDiscounts(updated, roundUnit);
    }
    onChange(updated);
  };

  const handleItemName = (idx, value) => {
    const items = [...pkg.items];
    items[idx] = { ...items[idx], procedureName: value };
    onChange({ ...pkg, items });
  };

  // 개별 할인율 변경
  const handleItemDiscount = useCallback((idx, value) => {
    const rate = Math.min(100, Math.max(0, Number(value) || 0));
    const items = [...pkg.items];
    items[idx] = { ...items[idx], discountRate: rate };
    const updated = { ...pkg, items };
    updated.packagePrice = calcPackagePriceFromItemDiscounts(updated, roundUnit);
    setItemDiscountMode(true);
    onChange(updated);
  }, [pkg, roundUnit, onChange]);

  // 시술명 입력 + 자동완성 트리거
  const handleItemNameWithSearch = (idx, value) => {
    handleItemName(idx, value);
    setHighlightedIdx(-1);
    if (value.length >= 1 && (branchProcedures.length > 0 || loadRecentProcedures().length > 0)) {
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
      individualPrice: bp.standardPrice || bp.price || 0,
      priceSource: bp.standardPrice ? 'branch' : 'recent',
      branchCategory: bp.category,
    };
    const updated = { ...pkg, items };
    if (itemDiscountMode) {
      updated.packagePrice = calcPackagePriceFromItemDiscounts(updated, roundUnit);
    }
    onChange(updated);
    setActiveNameDropdown(null);
    setHighlightedIdx(-1);
    // 최근 사용에 저장
    saveRecentProcedure(bp);
  };

  // 시술명 검색 (지점 수가 + 최근 사용)
  const findNameMatches = (query) => {
    if (!query) return { recent: [], branch: [] };
    const q = query.trim().toLowerCase();
    if (q.length < 1) return { recent: [], branch: [] };

    // 토큰 분리 (공백 기준) - 각 토큰이 모두 포함되어야 매칭
    const tokens = q.split(/\s+/).filter((t) => t.length >= 1);
    const matchesFn = (name) => {
      const normalized = name.replace(/\s+/g, '').toLowerCase();
      return tokens.every((t) => normalized.includes(t));
    };

    // 최근 사용
    const recentAll = loadRecentProcedures();
    const recent = recentAll.filter((r) => matchesFn(r.name)).slice(0, 5);

    // 지점 수가
    const branch = branchProcedures.filter((bp) => matchesFn(bp.name)).slice(0, 15);

    return { recent, branch };
  };

  // 키보드 네비게이션
  const handleNameKeyDown = (e, idx, allMatches) => {
    if (activeNameDropdown !== idx || allMatches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev < allMatches.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : allMatches.length - 1));
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault();
      const item = allMatches[highlightedIdx];
      selectBranchItem(idx, item);
    } else if (e.key === 'Escape') {
      setActiveNameDropdown(null);
    }
  };

  const removeItem = (idx) => {
    const items = pkg.items.filter((_, i) => i !== idx);
    const updated = { ...pkg, items };
    if (itemDiscountMode) {
      updated.packagePrice = calcPackagePriceFromItemDiscounts(updated, roundUnit);
    }
    onChange(updated);
  };

  const addItem = () => {
    const items = [...pkg.items, { procedureName: '', quantity: 1, individualPrice: 0, priceSource: 'manual' }];
    onChange({ ...pkg, items });
  };

  const findBranchMatches = (procedureName) => {
    if (!procedureName || !branchProcedures.length) return [];
    const q = procedureName.trim().toLowerCase();
    if (q.length < 2) return [];
    const tokens = q.split(/\s+/).filter((t) => t.length >= 1);
    return branchProcedures.filter((bp) => {
      const name = bp.name.replace(/\s+/g, '').toLowerCase();
      const qNorm = q.replace(/\s+/g, '');
      // 전체 문자열 포함 OR 모든 토큰 포함
      return name.includes(qNorm) || qNorm.includes(name) ||
        (tokens.length > 1 && tokens.every((t) => name.includes(t)));
    }).slice(0, 10);
  };

  const hasAllPrices = pkg.items.every((item) => Number(item.individualPrice) > 0);
  const savingsPositive = summary.savingsAmount > 0;

  // 접힌 상태 요약 텍스트
  const collapsedItemText = pkg.items.map((i) => i.procedureName).filter(Boolean).join(' + ');

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 - 클릭으로 접기/펼치기 */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-100 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs text-gray-400 shrink-0 transition-transform" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          &#9660;
        </span>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
          {index + 1}
        </span>

        {collapsed ? (
          /* 접힌 상태: 이름 + 요약 */
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800 truncate">{pkg.name || '(이름 없음)'}</span>
            {collapsedItemText && (
              <span className="text-xs text-gray-400 truncate hidden sm:inline">({collapsedItemText})</span>
            )}
          </div>
        ) : (
          /* 펼친 상태: 이름 편집 */
          <input
            type="text"
            value={pkg.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm font-bold text-gray-800 bg-transparent border-none
                       focus:outline-none focus:ring-0 placeholder-gray-400"
            placeholder="패키지명"
          />
        )}

        {/* 접힌 상태 뱃지들 */}
        {collapsed && pkg.packagePrice > 0 && (
          <span className="text-sm font-bold text-indigo-700 shrink-0">{formatNumber(pkg.packagePrice)}원</span>
        )}
        {collapsed && summary.savingsPercent > 0 && (
          <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded shrink-0">
            {summary.savingsPercent}%
          </span>
        )}

        {/* 메모 아이콘 */}
        {pkg.memo && (
          <span className="text-[10px] text-amber-500 shrink-0" title={pkg.memo}>&#x1F4DD;</span>
        )}

        {/* 순서 이동 버튼 */}
        {onMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xs shrink-0 px-1 py-0.5 rounded"
            title="위로 이동"
          >
            ↑
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xs shrink-0 px-1 py-0.5 rounded"
            title="아래로 이동"
          >
            ↓
          </button>
        )}

        {onDuplicate && (
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="text-gray-400 hover:text-indigo-500 transition-colors text-sm shrink-0 px-1"
            title="패키지 복제"
          >
            &#x29C9;
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-gray-400 hover:text-red-500 transition-colors text-sm font-bold shrink-0 px-1"
          title="패키지 삭제"
        >
          &times;
        </button>
      </div>

      {/* 접힌 상태면 여기서 끝 */}
      {collapsed && null}

      {/* 펼친 상태 내용 */}
      {!collapsed && (
        <>
          {/* 메모 전체 표시 */}
          {pkg.memo && (
            <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100">
              <p className="text-[11px] text-amber-700 leading-relaxed whitespace-pre-wrap break-words">
                {pkg.memo}
              </p>
            </div>
          )}

          {/* 구성 시술 */}
          <div className="px-4 py-3 space-y-1.5">
            {pkg.items.map((item, idx) => {
              const priceMatches = findBranchMatches(item.procedureName);
              const isPriceOpen = openPriceDropdown === idx;
              const nameMatchResult = activeNameDropdown === idx ? findNameMatches(item.procedureName) : { recent: [], branch: [] };
              const allNameMatches = [
                ...nameMatchResult.recent.map((r) => ({ ...r, standardPrice: r.price, _isRecent: true })),
                ...nameMatchResult.branch,
              ];
              const isNameOpen = activeNameDropdown === idx && allNameMatches.length > 0;

              // 유사 추천 (정가 미입력 시)
              const similarItems = (!item.individualPrice && item.procedureName?.length >= 2)
                ? findSimilarBranchItems(item.procedureName, branchProcedures, 3)
                : [];

              // 개별 할인율: 사용자 입력 또는 역산값
              const displayDiscount = itemDiscountMode
                ? (item.discountRate ?? 0)
                : (reversedDiscounts[idx] ?? 0);

              // 할인 적용가
              const itemTotal = (Number(item.individualPrice) || 0) * (Number(item.quantity) || 1);
              const discountedPrice = itemTotal > 0 ? Math.round(itemTotal * (1 - displayDiscount / 100)) : 0;

              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center gap-2 relative">
                    {/* 시술명 + 자동완성 드롭다운 */}
                    <div className="flex-1 min-w-0 relative" ref={isNameOpen ? nameDropdownRef : undefined}>
                      <input
                        type="text"
                        value={item.procedureName}
                        onChange={(e) => handleItemNameWithSearch(idx, e.target.value)}
                        onFocus={() => {
                          if (item.procedureName.length >= 1 && (branchProcedures.length > 0 || loadRecentProcedures().length > 0)) {
                            setActiveNameDropdown(idx);
                            setHighlightedIdx(-1);
                          }
                        }}
                        onKeyDown={(e) => handleNameKeyDown(e, idx, allNameMatches)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs
                                   focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        placeholder={branchProcedures.length > 0 ? '시술명 검색...' : '시술명'}
                      />

                      {/* 자동완성 드롭다운 (최근 사용 + 지점 수가) */}
                      {isNameOpen && (
                        <div
                          className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl
                                        max-h-64 w-full min-w-[300px]"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {/* 최근 사용 섹션 */}
                          {nameMatchResult.recent.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 bg-amber-50 border-b border-gray-200 text-[10px] font-medium text-amber-700 sticky top-0 z-10">
                                최근 사용
                              </div>
                              {nameMatchResult.recent.map((r, ri) => {
                                const globalIdx = ri;
                                return (
                                  <button
                                    key={`recent-${ri}`}
                                    type="button"
                                    onClick={() => selectBranchItem(idx, { name: r.name, standardPrice: r.price, category: r.category })}
                                    className={`w-full px-3 py-2 text-left transition-colors
                                               flex items-center justify-between gap-2 text-xs border-b border-gray-50 last:border-b-0
                                               ${globalIdx === highlightedIdx ? 'bg-amber-100' : 'hover:bg-amber-50'}`}
                                  >
                                    <span className="text-gray-700 font-medium">{r.name}</span>
                                    {r.price > 0 && (
                                      <span className="font-bold text-amber-700 shrink-0">{formatNumber(r.price)}원</span>
                                    )}
                                  </button>
                                );
                              })}
                            </>
                          )}

                          {/* 지점 수가 섹션 */}
                          {nameMatchResult.branch.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 bg-indigo-50 border-b border-gray-200 text-[10px] font-medium text-indigo-600 sticky top-0 z-10">
                                {activeBranch} 수가표 ({nameMatchResult.branch.length}건)
                              </div>
                              <div className="max-h-48 overflow-y-auto overscroll-contain">
                                {nameMatchResult.branch.map((bp, mi) => {
                                  const globalIdx = nameMatchResult.recent.length + mi;
                                  return (
                                    <button
                                      key={`branch-${mi}`}
                                      type="button"
                                      onClick={() => selectBranchItem(idx, bp)}
                                      className={`w-full px-3 py-2 text-left transition-colors
                                                 flex items-center justify-between gap-2 text-xs border-b border-gray-50 last:border-b-0
                                                 ${globalIdx === highlightedIdx ? 'bg-indigo-100' : 'hover:bg-indigo-50'}`}
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
                                  );
                                })}
                              </div>
                            </>
                          )}
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
                          placeholder="정가(VAT별도)"
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

                    {/* 개별 할인율 입력 */}
                    {item.individualPrice > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <input
                          type="number"
                          value={displayDiscount || ''}
                          onChange={(e) => handleItemDiscount(idx, e.target.value)}
                          min="0"
                          max="100"
                          placeholder="0"
                          className="w-14 px-1 py-1.5 border border-purple-200 rounded text-xs text-center
                                     focus:outline-none focus:ring-1 focus:ring-purple-300 bg-purple-50"
                          title="개별 할인율 (%)"
                        />
                        <span className="text-[10px] text-purple-500">%</span>
                      </div>
                    )}

                    {item.individualPrice > 0 && item.priceSource && item.priceSource !== 'manual' && (
                      <span className={`text-[10px] leading-none px-1 py-0.5 rounded shrink-0 ${
                        item.priceSource === 'branch'
                          ? 'bg-teal-100 text-teal-700'
                          : item.priceSource === 'trial'
                          ? 'bg-blue-100 text-blue-700'
                          : item.priceSource === 'recent'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {item.priceSource === 'branch' ? '수가' : item.priceSource === 'trial' ? '1체' : item.priceSource === 'recent' ? '최근' : '이벤트'}
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

                  {/* 할인 적용가 표시 (할인율이 있을 때) */}
                  {item.individualPrice > 0 && displayDiscount > 0 && (
                    <div className="ml-0 pl-2 text-[10px] text-purple-600">
                      {formatNumber(itemTotal)}원 &rarr; {formatNumber(discountedPrice)}원
                    </div>
                  )}

                  {/* 유사 항목 추천 (정가 미입력 시) */}
                  {similarItems.length > 0 && (
                    <div className="ml-2 flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-orange-500">추천:</span>
                      {similarItems.map((si, si_idx) => (
                        <button
                          key={si_idx}
                          type="button"
                          onClick={() => selectBranchItem(idx, si)}
                          className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded
                                     hover:bg-orange-100 transition-colors border border-orange-200"
                        >
                          {si.name} ({formatNumber(si.standardPrice)}원)
                        </button>
                      ))}
                    </div>
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
                <label className="block text-xs text-gray-500 mb-1">패키지 이벤트가 <span className="text-gray-400">(VAT 별도)</span></label>
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
                {pkg.packagePrice > 0 && (
                  <div className="text-[10px] text-teal-600 mt-0.5">
                    VAT 포함 {formatNumber(Math.round(Number(pkg.packagePrice) * 1.1))}원
                  </div>
                )}
              </div>

              {/* 요약 뱃지 */}
              {hasAllPrices && summary.totalRegularPrice > 0 && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400">
                    정가 {formatNumber(summary.totalRegularPrice)}원
                    <span className="text-gray-300 ml-1">(VAT 포함 {formatNumber(Math.round(summary.totalRegularPrice * 1.1))}원)</span>
                  </div>
                  {pkg.packagePrice > 0 && (
                    <div className={`text-sm font-bold ${savingsPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {savingsPositive ? '-' : '+'}{formatNumber(Math.abs(summary.savingsAmount))}원
                      <span className="text-xs ml-0.5">({summary.savingsPercent}%)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 시술별 기여도 표시 */}
            {hasAllPrices && pkg.packagePrice > 0 && summary.perItemBreakdown.length > 1 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowContribution(!showContribution)}
                  className="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
                >
                  {showContribution ? '기여도 숨기기 ▲' : '시술별 기여도 ▼'}
                </button>
                {showContribution && (
                  <div className="mt-1.5 space-y-1 text-[11px]">
                    {summary.perItemBreakdown.map((bi, biIdx) => (
                      <div key={biIdx} className="flex items-center gap-2 text-gray-600">
                        <span className="flex-1 truncate">{bi.name} {bi.quantity > 1 ? `x${bi.quantity}` : ''}</span>
                        <span className="text-gray-400">{formatNumber(bi.originalPrice)}원</span>
                        <span className="text-indigo-600 font-medium">&rarr; {formatNumber(bi.allocatedPrice)}원</span>
                        <span className={`font-bold shrink-0 ${bi.savingsPercent > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {bi.savingsPercent > 0 ? `-${bi.savingsPercent}%` : '0%'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 가격 미입력 경고 */}
            {!hasAllPrices && (
              <p className="text-xs text-orange-500 mt-2">
                일부 시술의 정가가 입력되지 않았습니다. 시술명을 입력하면 수가표에서 자동 검색됩니다.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
