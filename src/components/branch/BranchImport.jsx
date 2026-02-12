/**
 * BranchImport.jsx - CSV 파일 업로드 + 미리보기 + 저장
 */

import { useState, useRef } from 'react';
import { parseCSVFile } from '../../utils/csvParser';
import { saveBranchData, hasBranch } from '../../utils/branchStorage';
import { formatNumber } from '../../utils/pricing';

const BRANCH_NAMES = [
  '대전', '구월', '여의도', '동대문', '제주',
  '수원망포', '원주', '해운대', '김해', '부천', '천호',
];

export default function BranchImport({ onImported, onToast }) {
  const [branchName, setBranchName] = useState('');
  const [customName, setCustomName] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const effectiveName = branchName === '__custom__' ? customName.trim() : branchName;
  const alreadyExists = effectiveName ? hasBranch(effectiveName) : false;

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
