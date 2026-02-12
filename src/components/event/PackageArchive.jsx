/**
 * PackageArchive.jsx - 패키지 아카이브 (대분류 그룹 + 소분류 패키지)
 *
 * 대분류: 이벤트명/기간 (예: "1월 한정이벤트", "경쟁사 A클리닉")
 * 소분류: 개별 패키지 (예: "슈링크300+인모드fx 690,000원")
 * 대분류/소분류 독립 검색 + 엑셀 다운로드
 */

import { useState, useMemo, useCallback } from 'react';
import { formatNumber } from '../../utils/pricing';
import { copyToClipboard } from '../../utils/export';

const STORAGE_KEY = 'vans-pricing-archive';

function loadArchive() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveArchiveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('아카이브 저장 실패:', err);
  }
}

/**
 * 외부에서 패키지를 아카이브에 추가
 * @param {string} groupName - 대분류 이름
 * @param {Array} packages - 패키지 배열
 * @param {string} source - '자사' | '경쟁사'
 * @param {string} sourceName - 출처명
 */
export function addToArchive(groupName, packages, source = '자사', sourceName = '') {
  const archive = loadArchive();
  const group = {
    id: Date.now() + Math.random(),
    groupName: groupName || new Date().toLocaleDateString('ko-KR') + ' 이벤트',
    source,
    sourceName,
    createdAt: new Date().toISOString(),
    packages: packages.map((p) => ({
      id: (p.id || Date.now()) + Math.random(),
      name: p.name,
      packagePrice: p.packagePrice || 0,
      items: p.items?.map((i) => ({
        procedureName: i.procedureName,
        quantity: i.quantity || 1,
        individualPrice: i.individualPrice || 0,
      })) || [],
      memo: p.memo || '',
    })),
  };
  archive.unshift(group);
  saveArchiveData(archive);
  return group;
}

export default function PackageArchive({ onToast }) {
  const [archive, setArchive] = useState(() => loadArchive());
  const [isOpen, setIsOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('전체');
  const [groupQuery, setGroupQuery] = useState('');
  const [pkgQuery, setPkgQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Add form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newSource, setNewSource] = useState('경쟁사');
  const [newSourceName, setNewSourceName] = useState('');
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [newPkgMemo, setNewPkgMemo] = useState('');
  const [pendingPackages, setPendingPackages] = useState([]);

  // Total package count
  const totalPkgCount = useMemo(() => archive.reduce((sum, g) => sum + (g.packages?.length || 0), 0), [archive]);

  // Filter logic: 대분류/소분류 독립 검색
  const filtered = useMemo(() => {
    let list = archive;

    // Source filter
    if (sourceFilter !== '전체') {
      list = list.filter((g) => g.source === sourceFilter);
    }

    // Group name filter (대분류)
    if (groupQuery.trim()) {
      const gq = groupQuery.replace(/\s+/g, '').toLowerCase();
      list = list.filter((g) =>
        g.groupName?.replace(/\s+/g, '').toLowerCase().includes(gq) ||
        g.sourceName?.replace(/\s+/g, '').toLowerCase().includes(gq)
      );
    }

    // Package name filter (소분류) — filter packages within groups
    if (pkgQuery.trim()) {
      const pq = pkgQuery.replace(/\s+/g, '').toLowerCase();
      list = list
        .map((g) => ({
          ...g,
          packages: g.packages?.filter((p) =>
            p.name?.replace(/\s+/g, '').toLowerCase().includes(pq) ||
            p.memo?.replace(/\s+/g, '').toLowerCase().includes(pq) ||
            p.items?.some((i) => i.procedureName?.replace(/\s+/g, '').toLowerCase().includes(pq))
          ) || [],
        }))
        .filter((g) => g.packages.length > 0);
    }

    return list;
  }, [archive, sourceFilter, groupQuery, pkgQuery]);

  const toggleGroup = useCallback((id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteGroup = useCallback((id) => {
    if (!window.confirm('이 그룹 전체를 삭제하시겠습니까?')) return;
    const updated = archive.filter((g) => g.id !== id);
    setArchive(updated);
    saveArchiveData(updated);
    onToast?.('아카이브 그룹이 삭제되었습니다');
  }, [archive, onToast]);

  const deletePackageFromGroup = useCallback((groupId, pkgId) => {
    const updated = archive.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, packages: g.packages.filter((p) => p.id !== pkgId) };
    }).filter((g) => g.packages.length > 0);
    setArchive(updated);
    saveArchiveData(updated);
    onToast?.('패키지가 삭제되었습니다');
  }, [archive, onToast]);

  // Add pending package to list
  const addPendingPkg = useCallback(() => {
    if (!newPkgName.trim()) {
      onToast?.('패키지명을 입력하세요');
      return;
    }
    setPendingPackages((prev) => [...prev, {
      id: Date.now() + Math.random(),
      name: newPkgName.trim(),
      packagePrice: Number(newPkgPrice) || 0,
      items: [],
      memo: newPkgMemo.trim(),
    }]);
    setNewPkgName('');
    setNewPkgPrice('');
    setNewPkgMemo('');
  }, [newPkgName, newPkgPrice, newPkgMemo, onToast]);

  // Save entire group
  const saveNewGroup = useCallback(() => {
    if (!newGroupName.trim()) {
      onToast?.('대분류명을 입력하세요');
      return;
    }
    if (pendingPackages.length === 0) {
      onToast?.('패키지를 1개 이상 추가하세요');
      return;
    }
    const group = {
      id: Date.now() + Math.random(),
      groupName: newGroupName.trim(),
      source: newSource,
      sourceName: newSourceName.trim(),
      createdAt: new Date().toISOString(),
      packages: pendingPackages,
    };
    const updated = [group, ...archive];
    setArchive(updated);
    saveArchiveData(updated);
    setNewGroupName('');
    setNewSourceName('');
    setPendingPackages([]);
    setShowAddForm(false);
    onToast?.('아카이브 그룹이 추가되었습니다');
  }, [archive, newGroupName, newSource, newSourceName, pendingPackages, onToast]);

  // Excel copy
  const handleExcelCopy = useCallback(async () => {
    const rows = [];
    rows.push(['대분류', '구분', '출처', '패키지명', '가격', '구성시술', '메모', '날짜'].join('\t'));
    for (const g of filtered) {
      for (const p of g.packages) {
        rows.push([
          g.groupName,
          g.source,
          g.sourceName || '',
          p.name,
          p.packagePrice || 0,
          p.items?.map((i) => i.procedureName).join(' + ') || '',
          p.memo || '',
          formatDate(g.createdAt),
        ].join('\t'));
      }
    }
    const ok = await copyToClipboard(rows.join('\n'));
    onToast?.(ok ? '엑셀 형식으로 복사되었습니다' : '복사에 실패했습니다');
  }, [filtered, onToast]);

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  // Refresh for external updates
  const refresh = useCallback(() => setArchive(loadArchive()), []);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-300">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 text-left"
      >
        <h3 className="text-sm font-bold text-gray-700">
          패키지 아카이브
          {archive.length > 0 && (
            <span className="text-gray-400 font-normal ml-1">
              ({archive.length}그룹 · {totalPkgCount}패키지)
            </span>
          )}
        </h3>
        <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3">
          {/* Filter tabs + actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {['전체', '자사', '경쟁사'].map((tab) => (
              <button
                key={tab}
                onClick={() => setSourceFilter(tab)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border
                  ${sourceFilter === tab
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {tab}
              </button>
            ))}
            <div className="flex-1" />
            {filtered.length > 0 && (
              <button
                onClick={handleExcelCopy}
                className="text-xs px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded font-medium transition-colors"
              >
                엑셀 복사
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors
                ${showAddForm ? 'bg-gray-200 text-gray-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
            >
              {showAddForm ? '닫기' : '+ 직접 추가'}
            </button>
          </div>

          {/* Search: 대분류 + 소분류 독립 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
              placeholder="대분류 검색 (이벤트명, 출처)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              value={pkgQuery}
              onChange={(e) => setPkgQuery(e.target.value)}
              placeholder="소분류 검색 (패키지명, 시술명)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="text-xs font-bold text-gray-700">새 그룹 추가</div>
              {/* Group info */}
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="대분류명 (예: 1월 한정이벤트)"
                  className="flex-1 min-w-[180px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <select
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="경쟁사">경쟁사</option>
                  <option value="자사">자사</option>
                </select>
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="출처명 (예: A클리닉)"
                  className="min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              {/* Pending packages list */}
              {pendingPackages.length > 0 && (
                <div className="space-y-1">
                  {pendingPackages.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between px-2 py-1 bg-white rounded border border-gray-200 text-xs">
                      <span className="text-gray-700">{p.name}</span>
                      <div className="flex items-center gap-2">
                        {p.packagePrice > 0 && <span className="font-bold text-indigo-700">{formatNumber(p.packagePrice)}원</span>}
                        {p.memo && <span className="text-gray-400 italic">{p.memo}</span>}
                        <button
                          onClick={() => setPendingPackages((prev) => prev.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add package to group */}
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  placeholder="패키지명"
                  className="flex-1 min-w-[140px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="number"
                  value={newPkgPrice}
                  onChange={(e) => setNewPkgPrice(e.target.value)}
                  placeholder="가격"
                  min="0"
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  value={newPkgMemo}
                  onChange={(e) => setNewPkgMemo(e.target.value)}
                  placeholder="메모"
                  className="min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={addPendingPkg}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700 transition-colors shrink-0"
                >
                  + 패키지
                </button>
              </div>

              {/* Save group button */}
              <button
                onClick={saveNewGroup}
                disabled={!newGroupName.trim() || pendingPackages.length === 0}
                className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                그룹 저장 ({pendingPackages.length}개 패키지)
              </button>
            </div>
          )}

          {/* Archive list */}
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {archive.length === 0 ? '저장된 아카이브가 없습니다' : '검색 결과가 없습니다'}
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                return (
                  <div key={group.id} className="rounded-lg border border-gray-200 overflow-hidden">
                    {/* Group header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <span className={`text-xs text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                      <span className="font-bold text-sm text-gray-800 flex-1 min-w-0 truncate">{group.groupName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        group.source === '자사' ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {group.source}
                      </span>
                      {group.sourceName && (
                        <span className="text-xs text-gray-500">{group.sourceName}</span>
                      )}
                      <span className="text-[10px] text-gray-400">{group.packages.length}개</span>
                      <span className="text-[10px] text-gray-300">{formatDate(group.createdAt)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                        className="text-xs text-red-400 hover:text-red-600 px-1 transition-colors"
                        title="그룹 삭제"
                      >
                        ×
                      </button>
                    </div>

                    {/* Packages within group */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {group.packages.map((pkg) => (
                          <div key={pkg.id} className="flex items-center justify-between px-4 py-2 bg-white">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-gray-800">{pkg.name}</div>
                              {pkg.items?.length > 0 && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  {pkg.items.map((i) => i.procedureName).join(' + ')}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-bold text-indigo-700">{formatNumber(pkg.packagePrice)}원</span>
                                {pkg.memo && <span className="text-[10px] text-gray-400 italic">{pkg.memo}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => deletePackageFromGroup(group.id, pkg.id)}
                              className="text-[10px] text-red-400 hover:text-red-600 px-1 shrink-0 transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
