/**
 * BranchSelector.jsx - 재사용 가능한 지점 드롭다운
 * BranchTab과 EventTab 양쪽에서 사용
 */

import { loadManifest } from '../../utils/branchStorage';

export default function BranchSelector({ value, onChange, size = 'md' }) {
  const manifest = loadManifest();
  const branches = manifest.branches || [];

  if (branches.length === 0) {
    return (
      <span className="text-xs text-gray-400 italic">
        지점 수가를 먼저 가져오세요
      </span>
    );
  }

  const sizeClass = size === 'sm'
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-2 text-sm';

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`${sizeClass} border border-teal-300 rounded font-medium text-teal-700
                  bg-white focus:outline-none focus:ring-2 focus:ring-teal-400
                  cursor-pointer`}
    >
      <option value="">지점 선택...</option>
      {branches.map((b) => (
        <option key={b.name} value={b.name}>
          {b.name} ({b.rowCount}개)
        </option>
      ))}
    </select>
  );
}
