/**
 * BranchImport.jsx - CSV 파일 업로드 + 미리보기 + 저장
 */

import { useState, useRef, useMemo } from 'react';
import { parseCSVFile } from '../../utils/csvParser';
import { saveBranchData, hasBranch, loadManifest, loadBranchData } from '../../utils/branchStorage';
import { formatNumber } from '../../utils/pricing';

const DEFAULT_BRANCH_NAMES = [
  '대전', '구월', '여의도', '동대문', '제주',
  '수원망포', '원주', '해운대', '김해', '부천', '천호',
];

export default function BranchImport({ onImported, onToast }) {
  // 동적 지점 목록: 기본 + 이미 가져온 지점명 병합
  const BRANCH_NAMES = useMemo(() => {
    const manifest = loadManifest();
    const existing = manifest.branches.map((b) => b.name);
    const merged = [...DEFAULT_BRANCH_NAMES];
    for (const name of existing) {
      if (!merged.includes(name)) merged.push(name);
    }
    return merged;
  }, []);
  const [branchName, setBranchName] = useState('');
  const [customName, setCustomName] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const fileRef = useRef(null);

  const effectiveName = branchName === '__custom__' ? customName.trim() : branchName;
  const alreadyExists = effectiveName ? hasBranch(effectiveName) : false;

  const priceDiff = useMemo(() => {
    if (!alreadyExists || !preview?.data?.length || !effectiveName) return null;
    const oldData = loadBranchData(effectiveName);
    if (!oldData.length) return null;

    // Build maps by name (normalized)
    const oldMap = new Map();
    for (const item of oldData) {
      oldMap.set(item.name.replace(/\s+/g, '').toLowerCase(), item);
    }
    const newMap = new Map();
    for (const item of preview.data) {
      newMap.set(item.name.replace(/\s+/g, '').toLowerCase(), item);
    }

    const changed = [];
    const added = [];
    const removed = [];

    // Find changed and added
    for (const item of preview.data) {
      const key = item.name.replace(/\s+/g, '').toLowerCase();
      const old = oldMap.get(key);
      if (!old) {
        added.push(item);
      } else if (old.standardPrice !== item.standardPrice) {
        changed.push({
          name: item.name,
          category: item.category,
          oldPrice: old.standardPrice,
          newPrice: item.standardPrice,
          diff: item.standardPrice - old.standardPrice,
        });
      }
    }

    // Find removed
    for (const item of oldData) {
      const key = item.name.replace(/\s+/g, '').toLowerCase();
      if (!newMap.has(key)) {
        removed.push(item);
      }
    }

    if (changed.length === 0 && added.length === 0 && removed.length === 0) return null;
    return { changed, added, removed };
  }, [alreadyExists, effectiveName, preview]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await parseCSVFile(file);
      setPreview(result);

      // 파일명에서 지점명 자동 추출
      if (!branchName) {
        const match = file.name.match(/^(.+?)\s*수가표/);
        if (match) {
          const detected = match[1].trim();
          if (BRANCH_NAMES.includes(detected)) {
            setBranchName(detected);
          } else {
            setBranchName('__custom__');
            setCustomName(detected);
          }
        }
      }
    } catch (err) {
      onToast?.(`CSV 파싱 실패: ${err.message}`);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!effectiveName || !preview?.data?.length) return;

    if (alreadyExists && !window.confirm(
      `"${effectiveName}" 지점 데이터가 이미 있습니다.\n기존 데이터를 덮어쓰시겠습니까?`
    )) return;

    try {
      saveBranchData(effectiveName, preview.data);
      onToast?.(`${effectiveName} 지점 ${preview.data.length}개 항목이 저장되었습니다`);
      onImported?.(effectiveName);
      // 초기화
      setPreview(null);
      setBranchName('');
      setCustomName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      onToast?.(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* 지점 선택 + 파일 업로드 */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">지점</label>
          <select
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">지점 선택...</option>
            {BRANCH_NAMES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
            <option value="__custom__">직접 입력</option>
          </select>
        </div>

        {branchName === '__custom__' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점명</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="지점명 입력"
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CSV 파일</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileSelect}
            className="block text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3
                       file:rounded file:border-0 file:text-sm file:font-medium
                       file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100
                       cursor-pointer"
          />
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">CSV 파싱 중...</div>
      )}

      {/* 미리보기 */}
      {preview && (
        <div className="border border-teal-200 rounded-lg overflow-hidden">
          <div className="bg-teal-50 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-bold text-teal-800">
              미리보기 ({preview.data.length}개 항목)
            </span>
            {alreadyExists && (
              <span className="text-xs text-orange-600 font-medium">
                기존 데이터 덮어쓰기
              </span>
            )}
          </div>

          {priceDiff && (
            <div className="px-4 py-2 bg-orange-50 border-b border-orange-200">
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-2 text-sm font-medium text-orange-700 w-full text-left"
              >
                <span className={`transition-transform text-xs ${showDiff ? 'rotate-90' : ''}`}>▶</span>
                가격 변동 감지:
                {priceDiff.changed.length > 0 && (
                  <span className="text-orange-600">{priceDiff.changed.length}개 변경</span>
                )}
                {priceDiff.added.length > 0 && (
                  <span className="text-green-600">{priceDiff.added.length}개 추가</span>
                )}
                {priceDiff.removed.length > 0 && (
                  <span className="text-red-600">{priceDiff.removed.length}개 삭제</span>
                )}
              </button>

              {showDiff && (
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {priceDiff.changed.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-bold text-orange-700 mb-1">가격 변경</div>
                      {priceDiff.changed.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                          <span className="text-gray-600 min-w-0 truncate flex-1">{item.name}</span>
                          <span className="text-gray-400 shrink-0">{formatNumber(item.oldPrice)}원</span>
                          <span className="text-gray-400 shrink-0">→</span>
                          <span className="font-bold text-orange-700 shrink-0">{formatNumber(item.newPrice)}원</span>
                          <span className={`text-xs shrink-0 ${item.diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            ({item.diff > 0 ? '+' : ''}{formatNumber(item.diff)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {priceDiff.added.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-bold text-green-700 mb-1">새로 추가</div>
                      {priceDiff.added.map((item, i) => (
                        <div key={i} className="text-xs py-0.5 text-green-700">
                          + {item.name} ({formatNumber(item.standardPrice)}원)
                        </div>
                      ))}
                    </div>
                  )}
                  {priceDiff.removed.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-red-700 mb-1">삭제됨</div>
                      {priceDiff.removed.map((item, i) => (
                        <div key={i} className="text-xs py-0.5 text-red-500">
                          - {item.name} ({formatNumber(item.standardPrice)}원)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-1.5 text-left text-gray-600">No.</th>
                  <th className="px-3 py-1.5 text-left text-gray-600">대분류</th>
                  <th className="px-3 py-1.5 text-left text-gray-600">진료항목명</th>
                  <th className="px-3 py-1.5 text-right text-gray-600">표준가격</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-400">{row.no}</td>
                    <td className="px-3 py-1.5 text-gray-600">{row.category}</td>
                    <td className="px-3 py-1.5 text-gray-800">{row.name}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-800">
                      {formatNumber(row.standardPrice)}원
                    </td>
                  </tr>
                ))}
                {preview.data.length > 8 && (
                  <tr className="border-t border-gray-100">
                    <td colSpan={4} className="px-3 py-1.5 text-center text-gray-400">
                      ... 외 {preview.data.length - 8}개 항목
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleImport}
              disabled={!effectiveName}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-bold rounded
                         hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                         transition-colors"
            >
              {effectiveName ? `${effectiveName} 지점으로 가져오기` : '지점을 선택하세요'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
