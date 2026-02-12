/**
 * BranchComparison.jsx - 지점간 가격 비교 (개선)
 *
 * 기능:
 *   - 실시간 자동완성 검색 (한 글자부터, 디바운스 적용)
 *   - 대분류 표시
 *   - 지점 다중선택 필터
 *   - 여러 시술 동시 비교 (테이블)
 *   - 최저가 하이라이트 + 가격 차이 표시
 *   - 키보드 네비게이션 (↑↓ + Enter)
 *   - 비교 결과 복사/내보내기
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  searchProceduresAcrossAllBranches,
  compareMultipleProcedures,
  loadManifest,
} from '../../utils/branchStorage';
import { formatNumber } from '../../utils/pricing';

export default function BranchComparison({ onToast }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState([]); // [{name, category}]
  const [enabledBranches, setEnabledBranches] = useState([]); // 선택된 지점
  const [highlightIndex, setHighlightIndex] = useState(-1); // 키보드 네비게이션
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // 전체 지점 목록
  const allBranches = useMemo(() => {
    const manifest = loadManifest();
    return manifest.branches.map((b) => b.name);
  }, []);

  // 초기: 전체 지점 선택
  useEffect(() => {
    if (enabledBranches.length === 0 && allBranches.length > 0) {
      setEnabledBranches([...allBranches]);
    }
  }, [allBranches, enabledBranches.length]);

  // 비교 결과
  const comparisonData = useMemo(() => {
    if (selectedProcedures.length === 0) return [];
    return compareMultipleProcedures(
      selectedProcedures.map((p) => p.name),
      enabledBranches,
    );
  }, [selectedProcedures, enabledBranches]);

  // 검색 자동완성 (디바운스 150ms)
  const handleQueryChange = useCallback((value) => {
    setQuery(value);
    setHighlightIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 1) {
      debounceRef.current = setTimeout(() => {
        const results = searchProceduresAcrossAllBranches(value.trim(), 30);
        setSuggestions(results);
        setShowDropdown(true);
      }, 150);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  // 시술 선택
  const handleSelectProcedure = useCallback((proc) => {
    setSelectedProcedures((prev) => {
      if (prev.some((p) => p.name === proc.name)) return prev;
      return [...prev, { name: proc.name, category: proc.category }];
    });
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  }, []);

  // 시술 제거
  const handleRemoveProcedure = useCallback((name) => {
    setSelectedProcedures((prev) => prev.filter((p) => p.name !== name));
  }, []);

  // 지점 토글
  const toggleBranch = useCallback((branchName) => {
    setEnabledBranches((prev) =>
      prev.includes(branchName)
        ? prev.filter((b) => b !== branchName)
        : [...prev, branchName],
    );
  }, []);

  // 전체 선택/해제
  const toggleAllBranches = useCallback(() => {
    setEnabledBranches((prev) =>
      prev.length === allBranches.length ? [] : [...allBranches],
    );
  }, [allBranches]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => {
          const next = prev < suggestions.length - 1 ? prev + 1 : 0;
          const el = dropdownRef.current?.children[next];
          el?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => {
          const next = prev > 0 ? prev - 1 : suggestions.length - 1;
          const el = dropdownRef.current?.children[next];
          el?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          const s = suggestions[highlightIndex];
          const alreadySelected = selectedProcedures.some((p) => p.name === s.name);
          if (!alreadySelected) handleSelectProcedure(s);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setHighlightIndex(-1);
        break;
    }
  }, [showDropdown, suggestions, highlightIndex, selectedProcedures, handleSelectProcedure]);

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 비교 테이블에서 행별 최저가/최고가 계산
  const getRowStats = (prices) => {
    const values = Object.values(prices).filter((v) => v > 0);
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  // 비교 결과 복사
  const handleCopyComparison = useCallback(() => {
    if (comparisonData.length === 0) return;
    const header = ['시술명', ...enabledBranches, '최저가', '최고가', '차이'].join('\t');
    const rows = comparisonData.map((row) => {
      const { min, max } = getRowStats(row.prices);
      const diff = max - min;
      const cols = enabledBranches.map((b) => {
        const p = row.prices[b];
        return p > 0 ? formatNumber(p) : '-';
      });
      return [row.name, ...cols, formatNumber(min), formatNumber(max), formatNumber(diff)].join('\t');
    });
    const text = [header, ...rows].join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      onToast?.('비교 결과가 클립보드에 복사되었습니다');
    });
  }, [comparisonData, enabledBranches, onToast]);

  return (
    <div className="space-y-4">
      {/* 검색창 + 자동완성 */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder="비교할 시술명 검색 (↑↓ 선택, Enter 추가)"
          className="w-full px-3 py-2.5 border border-teal-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
        />

        {/* 자동완성 드롭다운 */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200
                       rounded-lg shadow-lg max-h-[720px] overflow-y-auto"
          >
            {suggestions.map((s, i) => {
              const alreadySelected = selectedProcedures.some((p) => p.name === s.name);
              const avgPrice = s.branches.length > 0
                ? Math.round(s.branches.reduce((sum, b) => sum + b.price, 0) / s.branches.length)
                : 0;
              const isHighlighted = i === highlightIndex;
              return (
                <button
                  key={`${s.name}-${i}`}
                  onClick={() => !alreadySelected && handleSelectProcedure(s)}
                  disabled={alreadySelected}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm
                    border-b border-gray-50 last:border-b-0 transition-colors
                    ${alreadySelected
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      : isHighlighted
                        ? 'bg-teal-100 cursor-pointer'
                        : 'hover:bg-teal-50 cursor-pointer'
                    }`}
                >
                  <span className="text-xs text-gray-400 shrink-0 w-20 truncate">
                    {s.category}
                  </span>
                  <span className="flex-1 font-medium text-gray-800 truncate">
                    {s.name}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">
                    ~{formatNumber(avgPrice)}원
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 max-w-[180px] truncate" title={s.branches.map((b) => b.branch).join(', ')}>
                    {s.branches.map((b) => b.branch).join(', ')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 지점 필터 (항상 표시) */}
      {allBranches.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-xs text-gray-500 shrink-0">지점 필터:</span>
          <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={enabledBranches.length === allBranches.length}
              onChange={toggleAllBranches}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-400"
            />
            <span className="text-gray-600 font-medium">전체</span>
          </label>
          {allBranches.map((name) => (
            <label key={name} className="inline-flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={enabledBranches.includes(name)}
                onChange={() => toggleBranch(name)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-400"
              />
              <span className="text-gray-700">{name}</span>
            </label>
          ))}
        </div>
      )}

      {/* 선택된 시술 칩 */}
      {selectedProcedures.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProcedures.map((proc) => (
            <span
              key={proc.name}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-800
                         text-xs font-medium rounded-full"
            >
              {proc.category && (
                <span className="text-teal-500">{proc.category} &gt;</span>
              )}
              {proc.name}
              <button
                onClick={() => handleRemoveProcedure(proc.name)}
                className="ml-0.5 text-teal-500 hover:text-teal-800 font-bold"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={() => setSelectedProcedures([])}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
          >
            전체 삭제
          </button>
        </div>
      )}

      {/* 비교 테이블 */}
      {comparisonData.length > 0 && enabledBranches.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* 복사 버튼 */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs text-gray-500 font-medium">
              {comparisonData.length}개 시술 × {enabledBranches.length}개 지점
            </span>
            <button
              onClick={handleCopyComparison}
              className="text-xs px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors font-medium"
            >
              엑셀 복사
            </button>
          </div>

          {/* 데스크탑 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-gray-600 font-bold sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                    시술명
                  </th>
                  {enabledBranches.map((b) => (
                    <th key={b} className="px-3 py-2.5 text-right text-gray-600 font-bold min-w-[90px]">
                      {b}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right text-gray-600 font-bold min-w-[80px] bg-orange-50">
                    차이
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => {
                  const { min, max } = getRowStats(row.prices);
                  const diff = max - min;
                  return (
                    <tr key={row.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className={`px-3 py-2.5 font-medium text-gray-800 sticky left-0 z-10
                        ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div>{row.name}</div>
                        {row.category && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{row.category}</div>
                        )}
                      </td>
                      {enabledBranches.map((b) => {
                        const price = row.prices[b];
                        const isMin = price > 0 && price === min;
                        const isMax = price > 0 && price === max && min !== max;
                        const hasPrice = price !== undefined && price > 0;
                        return (
                          <td
                            key={b}
                            className={`px-3 py-2.5 text-right font-medium
                              ${isMin
                                ? 'bg-teal-50 text-teal-700 font-bold'
                                : isMax
                                  ? 'bg-red-50 text-red-600'
                                  : hasPrice
                                    ? 'text-gray-800'
                                    : 'text-gray-300'
                              }`}
                          >
                            {hasPrice ? (
                              <>
                                {formatNumber(price)}
                                {isMin && (
                                  <span className="ml-1 text-[10px] text-teal-500 font-bold">★</span>
                                )}
                              </>
                            ) : (
                              '-'
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-bold bg-orange-50 text-orange-700">
                        {diff > 0 ? `${formatNumber(diff)}원` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 뷰 */}
          <div className="sm:hidden">
            {comparisonData.map((row) => {
              const { min, max } = getRowStats(row.prices);
              const diff = max - min;
              return (
                <div key={`mobile-${row.name}`} className="p-3 border-b border-gray-100 last:border-b-0">
                  <div className="font-bold text-sm text-gray-800">{row.name}</div>
                  {row.category && <div className="text-[10px] text-gray-400">{row.category}</div>}
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {enabledBranches.map((b) => {
                      const price = row.prices[b];
                      const isMin = price > 0 && price === min;
                      const hasPrice = price !== undefined && price > 0;
                      return (
                        <div key={b} className={`flex justify-between text-xs px-2 py-1 rounded
                          ${isMin ? 'bg-teal-50 text-teal-700 font-bold' : 'text-gray-600'}`}>
                          <span>{b}</span>
                          <span>{hasPrice ? `${formatNumber(price)}원` : '-'}</span>
                        </div>
                      );
                    })}
                  </div>
                  {diff > 0 && (
                    <div className="mt-1 text-xs text-orange-600 font-bold text-right">
                      차이: {formatNumber(diff)}원
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {selectedProcedures.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">
          시술명을 검색하여 비교할 시술을 추가하세요
        </p>
      )}
    </div>
  );
}
