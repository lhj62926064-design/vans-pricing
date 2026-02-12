/**
 * BranchProcedureList.jsx - 검색/필터 가능한 시술 테이블
 * 50행씩 페이지네이션, 카테고리 필터, 이름 검색, 컬럼 정렬
 */

import { useState, useMemo } from 'react';
import { formatNumber } from '../../utils/pricing';
import { extractCategories } from '../../utils/branchStorage';

const PAGE_SIZE = 50;

export default function BranchProcedureList({ data, branchName, onToast }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortKey, setSortKey] = useState(null); // 'name' | 'price' | 'category' | null
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const categories = useMemo(() => extractCategories(data), [data]);

  const filtered = useMemo(() => {
    const q = query.replace(/\s+/g, '').toLowerCase();
    let result = data.filter((item) => {
      if (category && item.category !== category) return false;
      if (q && !item.name.replace(/\s+/g, '').toLowerCase().includes(q)) return false;
      return true;
    });

    // 정렬
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'name') {
          cmp = a.name.localeCompare(b.name, 'ko');
        } else if (sortKey === 'price') {
          cmp = (a.standardPrice || 0) - (b.standardPrice || 0);
        } else if (sortKey === 'category') {
          cmp = (a.category || '').localeCompare(b.category || '', 'ko');
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }, [data, query, category, sortKey, sortDir]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return <span className="text-gray-300 ml-0.5">↕</span>;
    return <span className="text-teal-600 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleCopyName = (name) => {
    navigator.clipboard?.writeText(name).then(() => {
      onToast?.(`"${name}" 복사됨`);
    });
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        지점을 선택하면 수가표가 표시됩니다
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 검색 + 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
          placeholder="시술명 검색..."
          className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setVisibleCount(PAGE_SIZE); }}
          className="px-3 py-2 border border-gray-300 rounded text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="">전체 카테고리</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          {filtered.length}개 결과
        </span>
      </div>

      {/* 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium w-16">No.</th>
                <th
                  className="px-3 py-2 text-left text-gray-600 font-medium cursor-pointer hover:text-teal-700 select-none"
                  onClick={() => handleSort('category')}
                >
                  대분류{sortIndicator('category')}
                </th>
                <th
                  className="px-3 py-2 text-left text-gray-600 font-medium cursor-pointer hover:text-teal-700 select-none"
                  onClick={() => handleSort('name')}
                >
                  진료항목명{sortIndicator('name')}
                </th>
                <th
                  className="px-3 py-2 text-right text-gray-600 font-medium w-28 cursor-pointer hover:text-teal-700 select-none"
                  onClick={() => handleSort('price')}
                >
                  표준가격{sortIndicator('price')}
                </th>
                <th className="px-3 py-2 text-center text-gray-600 font-medium w-12">과세</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr
                  key={`${row.no}-${i}`}
                  onClick={() => handleCopyName(row.name)}
                  className="border-t border-gray-100 hover:bg-teal-50/50 cursor-pointer transition-colors"
                  title="클릭하면 시술명이 복사됩니다"
                >
                  <td className="px-3 py-2 text-gray-400">{row.no}</td>
                  <td className="px-3 py-2 text-gray-500">{row.category}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-800">
                    {formatNumber(row.standardPrice)}원
                  </td>
                  <td className="px-3 py-2 text-center text-gray-400">{row.taxable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 더 보기 */}
        {hasMore && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
            >
              더 보기 ({filtered.length - visibleCount}개 남음)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
