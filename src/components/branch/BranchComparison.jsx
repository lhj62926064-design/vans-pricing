/**
 * BranchComparison.jsx - 지점간 가격 비교 (개선)
 *
 * 기능:
 *   - 실시간 자동완성 검색 (한 글자부터)
 *   - 대분류 표시
 *   - 지점 다중선택 필터
 *   - 여러 시술 동시 비교 (테이블)
 *   - 최저가 하이라이트
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  searchProceduresAcrossAllBranches,
  compareMultipleProcedures,
  loadManifest,
} from '../../utils/branchStorage';
import { formatNumber } from '../../utils/pricing';

export default function BranchComparison() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState([]); // [{name, category}]
  const [enabledBranches, setEnabledBranches] = useState([]); // 선택된 지점
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

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

  // 검색 자동완성
  const handleQueryChange = useCallback((value) => {
    setQuery(value);
    if (value.trim().length >= 1) {
      const results = searchProceduresAcrossAllBranches(value.trim(), 30);
      setSuggestions(results);
      setShowDropdown(true);
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
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 비교 테이블에서 행별 최저가 계산
  const getRowMin = (prices) => {
    const values = Object.values(prices).filter((v) => v > 0);
    return values.length > 0 ? Math.min(...values) : 0;
  };

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
          placeholder="비교할 시술명 검색 (한 글자부터 검색)"
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
              return (
                <button
                  key={`${s.name}-${i}`}
                  onClick={() => !alreadySelected && handleSelectProcedure(s)}
                  disabled={alreadySelected}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm
                    border-b border-gray-50 last:border-b-0 transition-colors
                    ${alreadySelected
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
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
          <div className="overflow-x-auto">
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
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => {
                  const minPrice = getRowMin(row.prices);
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
                        const isMin = price > 0 && price === minPrice;
                        const hasPrice = price !== undefined && price > 0;
                        return (
                          <td
                            key={b}
                            className={`px-3 py-2.5 text-right font-medium
                              ${isMin
                                ? 'bg-teal-50 text-teal-700 font-bold'
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
