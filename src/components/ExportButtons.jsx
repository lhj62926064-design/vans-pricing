/**
 * ExportButtons.jsx - 복사/내보내기/인쇄 버튼
 *
 * 역할:
 *   - 📱 카톡용: 보기 좋은 텍스트 (이모지 포함)
 *   - 📊 엑셀용: TSV 형식
 *   - 🖨️ 인쇄: window.print()
 *   - 복사 후 토스트 알림
 */

import { useCallback } from 'react';
import { generateKakaoText, generateExcelText, copyToClipboard } from '../utils/export';

export default function ExportButtons({ items, roundUnit, onToast }) {
  // ── 카카오톡 복사 ──
  const handleKakaoCopy = useCallback(async () => {
    try {
      const text = generateKakaoText(items, roundUnit);
      const success = await copyToClipboard(text);
      if (success) {
        onToast?.('📱 카톡용 텍스트가 복사되었습니다!');
      } else {
        onToast?.('복사에 실패했습니다.');
      }
    } catch (err) {
      console.error('카톡 복사 오류:', err);
      onToast?.('복사 중 오류가 발생했습니다.');
    }
  }, [items, roundUnit, onToast]);

  // ── 엑셀 복사 ──
  const handleExcelCopy = useCallback(async () => {
    try {
      const text = generateExcelText(items, roundUnit);
      const success = await copyToClipboard(text);
      if (success) {
        onToast?.('📊 엑셀용 텍스트(TSV)가 복사되었습니다!');
      } else {
        onToast?.('복사에 실패했습니다.');
      }
    } catch (err) {
      console.error('엑셀 복사 오류:', err);
      onToast?.('복사 중 오류가 발생했습니다.');
    }
  }, [items, roundUnit, onToast]);

  // ── 인쇄 ──
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        📋 내보내기
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleKakaoCopy}
          className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-50 border border-yellow-200
                     rounded-lg hover:bg-yellow-100 transition-colors"
        >
          📱 카톡 복사
        </button>
        <button
          onClick={handleExcelCopy}
          className="px-4 py-2 text-sm font-medium text-green-800 bg-green-50 border border-green-200
                     rounded-lg hover:bg-green-100 transition-colors"
        >
          📊 엑셀 복사
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200
                     rounded-lg hover:bg-gray-100 transition-colors"
        >
          🖨️ 인쇄
        </button>
      </div>
    </div>
  );
}
