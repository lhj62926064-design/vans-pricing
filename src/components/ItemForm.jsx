/**
 * ItemForm.jsx - 시술 입력 폼
 *
 * 역할:
 *   - 상품명, 유형(회차/샷수/혼합), 체험가, 이벤트가 입력
 *   - 유형에 따라 옵션 입력 폼 변경
 *     - 회차: sessions + price
 *     - 샷수: shots + price
 *     - 혼합: shots + sessions + price
 *   - 옵션 추가/삭제 버튼
 *   - 경쟁사 비교 토글 + 입력
 */

import { useCallback } from 'react';
import { generateOptionId } from './PricingCalculator';

/** 숫자 입력값 처리 (빈 문자열 허용) */
function numVal(val) {
  if (val === '' || val === undefined || val === null) return '';
  return val;
}

/** 유형별 옵션 입력 필드 정의 */
function getOptionFields(type) {
  switch (type) {
    case 'session':
      return [
        { key: 'sessions', label: '회차', placeholder: '3', min: '1' },
        { key: 'price', label: '가격 (원)', placeholder: '390000', min: '0' },
      ];
    case 'shot':
      return [
        { key: 'shots', label: '샷수', placeholder: '300', min: '1' },
        { key: 'price', label: '가격 (원)', placeholder: '390000', min: '0' },
      ];
    case 'mixed':
      return [
        { key: 'shots', label: '샷수', placeholder: '300', min: '1' },
        { key: 'sessions', label: '회차', placeholder: '3', min: '1' },
        { key: 'price', label: '가격 (원)', placeholder: '780000', min: '0' },
      ];
    default:
      return [];
  }
}

export default function ItemForm({ item, onChange }) {
  // ── 필드 변경 핸들러 ──
  const handleField = useCallback(
    (field, value) => {
      onChange({ ...item, [field]: value });
    },
    [item, onChange],
  );

  // ── 유형 변경 시 옵션 초기화 (경고 포함) ──
  const handleTypeChange = useCallback(
    (newType) => {
      if (newType === item.type) return;

      // 옵션이 있으면 경고
      if (item.options && item.options.length > 0) {
        if (!window.confirm('시술 유형을 변경하면 기존 옵션이 모두 초기화됩니다.\n계속하시겠습니까?')) {
          return;
        }
      }

      onChange({
        ...item,
        type: newType,
        options: [],
        baseShots: newType === 'session' ? 0 : item.baseShots || 100,
      });
    },
    [item, onChange],
  );

  // ── 옵션 관리 ──
  const addOption = useCallback(() => {
    const base = { _id: generateOptionId(), price: '' };
    const newOpt =
      item.type === 'session'
        ? { ...base, sessions: '' }
        : item.type === 'shot'
          ? { ...base, shots: '' }
          : { ...base, shots: '', sessions: '' }; // mixed
    onChange({ ...item, options: [...(item.options || []), newOpt] });
  }, [item, onChange]);

  const updateOption = useCallback(
    (idx, field, value) => {
      const updated = [...item.options];
      updated[idx] = { ...updated[idx], [field]: value };
      onChange({ ...item, options: updated });
    },
    [item, onChange],
  );

  const removeOption = useCallback(
    (idx) => {
      onChange({ ...item, options: item.options.filter((_, i) => i !== idx) });
    },
    [item, onChange],
  );

  // ── 경쟁사 관리 ──
  const toggleCompetitor = useCallback(() => {
    onChange({
      ...item,
      competitor: {
        ...item.competitor,
        enabled: !item.competitor.enabled,
      },
    });
  }, [item, onChange]);

  const updateCompetitor = useCallback(
    (field, value) => {
      onChange({
        ...item,
        competitor: { ...item.competitor, [field]: value },
      });
    },
    [item, onChange],
  );

  const typeLabels = {
    session: '회차 기반',
    shot: '샷수 기반',
    mixed: '혼합형 (샷×회)',
  };

  return (
    <div className="space-y-4">
      {/* 상품명 + 유형 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            상품명
          </label>
          <input
            type="text"
            value={item.name || ''}
            onChange={(e) => handleField('name', e.target.value)}
            placeholder="예: 슈링크 유니버스"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            시술 유형
          </label>
          <div className="flex gap-1">
            {Object.entries(typeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border
                  ${
                    item.type === key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 기준 정보 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            1회 체험가 (원)
          </label>
          <input
            type="number"
            value={numVal(item.trialPrice)}
            onChange={(e) => handleField('trialPrice', e.target.value)}
            placeholder="99000"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
            style={{ borderColor: 'var(--color-trial)' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            이벤트가 (원)
            {item.type === 'session' ? ' - 1회' : ''}
          </label>
          <input
            type="number"
            value={numVal(item.eventPrice)}
            onChange={(e) => handleField('eventPrice', e.target.value)}
            placeholder="150000"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            style={{ borderColor: 'var(--color-event)' }}
          />
        </div>
        {(item.type === 'shot' || item.type === 'mixed') && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              기준 샷수 (이벤트가 기준)
            </label>
            <input
              type="number"
              value={numVal(item.baseShots)}
              onChange={(e) => handleField('baseShots', e.target.value)}
              placeholder="100"
              min="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* 옵션 목록 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">
            다회/다샷 옵션
          </h4>
          <button
            onClick={addOption}
            className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-full
                       hover:bg-blue-100 transition-colors font-medium"
          >
            + 옵션 추가
          </button>
        </div>

        {(!item.options || item.options.length === 0) && (
          <p className="text-xs text-gray-400 italic">
            옵션이 없습니다. "옵션 추가" 버튼으로 추가하세요.
          </p>
        )}

        <div className="space-y-2">
          {(item.options || []).map((opt, idx) => (
            <div
              key={opt._id || idx}
              className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* 유형별 필드를 데이터 기반으로 렌더링 */}
              {getOptionFields(item.type).map((field) => (
                <div key={field.key} className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  <input
                    type="number"
                    value={numVal(opt[field.key])}
                    onChange={(e) => updateOption(idx, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    min={field.min}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}

              {/* 삭제 버튼 */}
              <button
                onClick={() => removeOption(idx)}
                className="px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50
                           rounded transition-colors text-sm font-bold shrink-0"
                title="옵션 삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 경쟁사 비교 */}
      <div className="border-t border-gray-200 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.competitor?.enabled || false}
            onChange={toggleCompetitor}
            className="w-4 h-4 rounded border-gray-300 text-purple-600
                       focus:ring-purple-400"
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-competitor)' }}>
            경쟁사 비교
          </span>
        </label>

        {item.competitor?.enabled && (
          <div className="mt-3 p-3 rounded-lg border-2 border-dashed"
               style={{ borderColor: 'var(--color-competitor)', backgroundColor: '#faf5ff' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">경쟁사명</label>
                <input
                  type="text"
                  value={item.competitor.name || ''}
                  onChange={(e) => updateCompetitor('name', e.target.value)}
                  placeholder="경쟁 병원명"
                  className="w-full border border-purple-200 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">가격 (원)</label>
                <input
                  type="number"
                  value={numVal(item.competitor.price)}
                  onChange={(e) => updateCompetitor('price', e.target.value)}
                  placeholder="200000"
                  min="0"
                  className="w-full border border-purple-200 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              {(item.type === 'session' || item.type === 'mixed') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">회차</label>
                  <input
                    type="number"
                    value={numVal(item.competitor.sessions)}
                    onChange={(e) => updateCompetitor('sessions', e.target.value)}
                    placeholder="1"
                    min="1"
                    className="w-full border border-purple-200 rounded px-2 py-1.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              )}
              {(item.type === 'shot' || item.type === 'mixed') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">샷수</label>
                  <input
                    type="number"
                    value={numVal(item.competitor.shots)}
                    onChange={(e) => updateCompetitor('shots', e.target.value)}
                    placeholder="100"
                    min="1"
                    className="w-full border border-purple-200 rounded px-2 py-1.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
