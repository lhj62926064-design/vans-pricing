/**
 * BranchComparison.jsx - 지점간 같은 시술 가격 비교
 */

import { useState } from 'react';
import { compareProcedureAcrossBranches } from '../../utils/branchStorage';
import { formatNumber } from '../../utils/pricing';

export default function BranchComparison() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    const found = compareProcedureAcrossBranches(query.trim());
    setResults(found);
    setSearched(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const minPrice = results.length > 0 ? results[0].standardPrice : 0;
  const maxPrice = results.length > 0 ? results[results.length - 1].standardPrice : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="비교할 시술명 입력 (예: 슈링크 300샷)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded
                     hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          비교
        </button>
      </div>

      {/* 결과 */}
      {searched && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          "{query}"에 해당하는 시술을 찾을 수 없습니다
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => {
            const isMin = r.standardPrice === minPrice;
            const barWidth = maxPrice > 0
              ? Math.max(15, Math.round((r.standardPrice / maxPrice) * 100))
              : 100;
            const diff = r.standardPrice - minPrice;

            return (
              <div
                key={r.branch}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors
                  ${isMin
                    ? 'bg-teal-50 border-teal-300'
                    : 'bg-white border-gray-200'
                  }`}
              >
                <div className="w-16 text-sm font-bold text-gray-700 shrink-0">
                  {r.branch}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 truncate mb-1">{r.name}</div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isMin ? 'bg-teal-500' : 'bg-gray-300'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${isMin ? 'text-teal-700' : 'text-gray-700'}`}>
                    {formatNumber(r.standardPrice)}원
                  </div>
                  {diff > 0 && (
                    <div className="text-xs text-red-400">
                      +{formatNumber(diff)}원
                    </div>
                  )}
                  {isMin && (
                    <div className="text-xs text-teal-600 font-bold">최저가</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
