/**
 * PresetManager.jsx - 프리셋 저장/불러오기/삭제 + JSON 내보내기/가져오기
 *
 * 역할:
 *   - 현재 전체 구성을 이름 지정해 저장
 *   - 프리셋 목록에서 불러오기/삭제
 *   - JSON 파일 다운로드 / 파일 선택해서 복원
 */

import { useState, useCallback, useRef } from 'react';
import {
  loadPresets,
  savePreset,
  deletePreset,
  getPresetData,
  exportToJSON,
  importFromJSON,
} from '../utils/storage';

export default function PresetManager({ currentData, onLoad, onToast }) {
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState(() => loadPresets());
  const [showPresets, setShowPresets] = useState(false);
  const fileInputRef = useRef(null);

  // 프리셋 목록 새로고침
  const refreshPresets = useCallback(() => {
    setPresets(loadPresets());
  }, []);

  // ── 프리셋 저장 ──
  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      onToast?.('프리셋 이름을 입력해주세요.');
      return;
    }

    const success = savePreset(name, currentData);
    if (success) {
      onToast?.(`"${name}" 프리셋이 저장되었습니다.`);
      setPresetName('');
      refreshPresets();
    } else {
      onToast?.('프리셋 저장에 실패했습니다.');
    }
  }, [presetName, currentData, onToast, refreshPresets]);

  // ── 프리셋 불러오기 ──
  const handleLoadPreset = useCallback(
    (name) => {
      const data = getPresetData(name);
      if (data) {
        onLoad(data);
        onToast?.(`"${name}" 프리셋을 불러왔습니다.`);
      } else {
        onToast?.('프리셋 데이터를 찾을 수 없습니다.');
      }
    },
    [onLoad, onToast],
  );

  // ── 프리셋 삭제 ──
  const handleDeletePreset = useCallback(
    (name) => {
      if (!window.confirm(`"${name}" 프리셋을 삭제하시겠습니까?`)) return;
      const success = deletePreset(name);
      if (success) {
        onToast?.(`"${name}" 프리셋이 삭제되었습니다.`);
        refreshPresets();
      }
    },
    [onToast, refreshPresets],
  );

  // ── JSON 내보내기 ──
  const handleExportJSON = useCallback(() => {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      exportToJSON(currentData, `vans-pricing-${dateStr}.json`);
      onToast?.('JSON 파일이 다운로드되었습니다.');
    } catch {
      onToast?.('JSON 내보내기에 실패했습니다.');
    }
  }, [currentData, onToast]);

  // ── JSON 가져오기 ──
  const handleImportJSON = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const data = await importFromJSON(file);
        onLoad(data);
        onToast?.('JSON 파일에서 데이터를 복원했습니다.');
      } catch (err) {
        onToast?.(`가져오기 실패: ${err.message}`);
      }

      // 파일 입력 초기화 (같은 파일 다시 선택 가능)
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onLoad, onToast],
  );

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
      <h3
        className="text-sm font-bold mb-3"
        style={{ color: 'var(--color-preset)' }}
      >
        💾 프리셋 & 데이터 관리
      </h3>

      {/* 프리셋 저장 */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="프리셋 이름 입력"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSavePreset();
          }}
        />
        <button
          onClick={handleSavePreset}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg
                     transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-preset)' }}
        >
          저장
        </button>
      </div>

      {/* 프리셋 목록 토글 */}
      <button
        onClick={() => {
          setShowPresets(!showPresets);
          refreshPresets();
        }}
        className="text-xs text-blue-500 hover:text-blue-700 mb-2 underline"
      >
        {showPresets ? '▲ 프리셋 목록 닫기' : '▼ 프리셋 목록 보기'}
        {presets.length > 0 && ` (${presets.length}개)`}
      </button>

      {/* 프리셋 목록 */}
      {showPresets && (
        <div className="mb-3">
          {presets.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-2">
              저장된 프리셋이 없습니다.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.name}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700 truncate block">
                      {preset.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(preset.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => handleLoadPreset(preset.name)}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded
                                 hover:bg-blue-100 transition-colors font-medium"
                    >
                      불러오기
                    </button>
                    <button
                      onClick={() => handleDeletePreset(preset.name)}
                      className="px-2 py-1 text-xs bg-red-50 text-red-500 rounded
                                 hover:bg-red-100 transition-colors font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* JSON 내보내기/가져오기 */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={handleExportJSON}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg
                     hover:bg-gray-200 transition-colors"
        >
          📥 JSON 저장
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg
                     hover:bg-gray-200 transition-colors"
        >
          📤 JSON 불러오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          className="hidden"
        />
      </div>
    </div>
  );
}
