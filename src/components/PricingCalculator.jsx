/**
 * PricingCalculator.jsx - 메인 계산기 컴포넌트
 *
 * 역할:
 *   - 전체 상태 관리 (items 배열, activeTab, roundUnit)
 *   - 탭 방식 시술 관리 (추가/삭제/전환)
 *   - 자동 저장/복원
 *   - 실시간 계산 결과 생성
 *   - 하위 컴포넌트 조합
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import ItemForm from './ItemForm';
import ResultTable from './ResultTable';
import WarningBanner from './WarningBanner';
import PresetManager from './PresetManager';
import ExportButtons from './ExportButtons';
import { computeItemRows } from '../utils/pricing';
import { validateMonotonic } from '../utils/validation';
import { autoSave, autoLoad, saveRoundUnit, loadRoundUnit } from '../utils/storage';

/** 새 시술 아이템 기본값 생성 */
function createDefaultItem(id) {
  return {
    id,
    name: '',
    type: 'session', // session | shot | mixed
    trialPrice: '',
    eventPrice: '',
    baseShots: 100,
    options: [],
    competitor: {
      enabled: false,
      name: '',
      price: '',
      sessions: 1,
      shots: 100,
    },
  };
}

/** 고유 ID 생성용 카운터 */
let _optIdCounter = Date.now();
export function generateOptionId() {
  return ++_optIdCounter;
}

export default function PricingCalculator() {
  // ── 상태 초기화 (localStorage에서 한 번만 복원) ──
  const [initialData] = useState(() => autoLoad());

  const [items, setItems] = useState(() => {
    if (initialData && Array.isArray(initialData.items) && initialData.items.length > 0) {
      // 기존 옵션에 id가 없으면 부여
      return initialData.items.map((item) => ({
        ...item,
        options: (item.options || []).map((opt) =>
          opt._id ? opt : { ...opt, _id: generateOptionId() }
        ),
      }));
    }
    return [createDefaultItem(1)];
  });

  const [activeTab, setActiveTab] = useState(() => {
    return initialData?.activeTab || 0;
  });

  const [roundUnit, setRoundUnit] = useState(() => loadRoundUnit());

  // 전체 보기 모드 (모든 시술을 한 화면에 쭉 표시)
  const [viewAll, setViewAll] = useState(false);

  // 토스트 메시지 상태
  const [toast, setToast] = useState(null);

  // ── 자동 저장 (debounce 300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSave({ items, activeTab });
    }, 300);
    return () => clearTimeout(timer);
  }, [items, activeTab]);

  useEffect(() => {
    saveRoundUnit(roundUnit);
  }, [roundUnit]);

  // ── 토스트 자동 숨김 ──
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── 탭 관리 ──
  const addTab = useCallback(() => {
    setItems((prev) => {
      const newId = prev.length > 0
        ? Math.max(...prev.map((i) => i.id)) + 1
        : 1;
      const next = [...prev, createDefaultItem(newId)];
      // 함수형 업데이트로 stale closure 방지
      setActiveTab(next.length - 1);
      return next;
    });
  }, []);

  const removeTab = useCallback(
    (idx) => {
      const itemName = items[idx]?.name || `시술 ${items[idx]?.id}`;
      if (items.length <= 1) return; // 최소 1개 유지

      // 데이터가 입력된 탭 삭제 시 확인
      const hasData = items[idx] && (
        items[idx].name ||
        items[idx].trialPrice ||
        items[idx].eventPrice ||
        (items[idx].options && items[idx].options.length > 0)
      );
      if (hasData && !window.confirm(`"${itemName}" 시술을 삭제하시겠습니까?\n입력된 데이터가 모두 사라집니다.`)) {
        return;
      }

      setItems((prev) => prev.filter((_, i) => i !== idx));
      setActiveTab((prev) => {
        if (prev >= idx && prev > 0) return prev - 1;
        return prev;
      });
    },
    [items],
  );

  // ── 아이템 업데이트 ──
  const updateItem = useCallback((idx, updatedItem) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? updatedItem : item)));
  }, []);

  // ── 전체 데이터 교체 (프리셋/JSON 불러오기용) ──
  const replaceAllData = useCallback((data) => {
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      setItems(data.items);
      setActiveTab(data.activeTab || 0);
    }
  }, []);

  // ── 실시간 계산 결과 (메모이제이션) ──
  const computedResults = useMemo(() => {
    return items.map((item) => {
      const numItem = {
        ...item,
        trialPrice: Number(item.trialPrice) || 0,
        eventPrice: Number(item.eventPrice) || 0,
        baseShots: Number(item.baseShots) || 100,
        options: (item.options || []).map((opt) => ({
          ...opt,
          price: Number(opt.price) || 0,
          sessions: Number(opt.sessions) || 1,
          shots: Number(opt.shots) || 100,
        })),
        competitor: item.competitor
          ? {
              ...item.competitor,
              price: Number(item.competitor.price) || 0,
              sessions: Number(item.competitor.sessions) || 1,
              shots: Number(item.competitor.shots) || 100,
            }
          : { enabled: false },
      };

      const rawRows = computeItemRows(numItem, roundUnit);
      const { rows, violations } = validateMonotonic(rawRows, item.name || `시술 ${item.id}`);

      return {
        name: item.name || `시술 ${item.id}`,
        type: item.type,
        rows,
        violations,
      };
    });
  }, [items, roundUnit]);

  // 전체 violations 모으기
  const allViolations = useMemo(() => {
    return computedResults.flatMap((r) => r.violations);
  }, [computedResults]);

  // 현재 활성 탭의 결과
  const activeResult = computedResults[activeTab] || null;

  // ── 토스트 표시 함수 ──
  const showToast = useCallback((msg) => {
    setToast(msg);
  }, []);

  // ── 반올림 단위 변경 ──
  const handleRoundUnitChange = (e) => {
    setRoundUnit(Number(e.target.value));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header
        className="text-white px-4 py-4 shadow-lg print:bg-white print:text-black print:shadow-none"
        style={{ backgroundColor: 'var(--color-header-bg)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">
            VANS Clinic 이벤트 가격 계산기
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="roundUnit" className="text-gray-300 print:text-gray-600">
              반올림:
            </label>
            <select
              id="roundUnit"
              value={roundUnit}
              onChange={handleRoundUnitChange}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400
                         print:bg-white print:text-black print:border-gray-300"
            >
              <option value={100} className="text-black">100원 단위</option>
              <option value={1000} className="text-black">1,000원 단위</option>
              <option value={10000} className="text-black">10,000원 단위</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* 경고 배너 */}
        <WarningBanner violations={allViolations} />

        {/* 탭 바 + 전체 보기 토글 (인쇄 시 숨김) */}
        <div className="flex items-end gap-1 overflow-x-auto pb-0 print:hidden">
          {/* 전체 보기 토글 */}
          <button
            onClick={() => setViewAll(!viewAll)}
            className={`flex items-center gap-1 px-3 py-2 rounded-t-lg text-sm font-bold
              transition-colors border border-b-0 whitespace-nowrap
              ${viewAll
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-blue-50 hover:text-blue-600'
              }`}
            title="모든 시술을 한 화면에 표시"
          >
            📋 전체 보기
          </button>

          {/* 구분선 */}
          <div className="w-px h-6 bg-gray-300 mx-1 mb-1 shrink-0" />

          {/* 개별 탭 */}
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-1 px-3 py-2 rounded-t-lg cursor-pointer text-sm font-medium
                transition-colors border border-b-0 whitespace-nowrap
                ${
                  !viewAll && idx === activeTab
                    ? 'bg-white text-gray-800 border-gray-300'
                    : 'bg-gray-200 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              onClick={() => { setViewAll(false); setActiveTab(idx); }}
            >
              <span>{item.name || `시술 ${item.id}`}</span>
              {items.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(idx);
                  }}
                  className="ml-1 text-gray-400 hover:text-red-500 text-xs font-bold leading-none"
                  title="시술 삭제"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTab}
            className="px-3 py-2 rounded-t-lg text-sm font-bold
                       bg-gray-100 text-gray-400 border border-b-0 border-gray-200
                       hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="시술 추가"
          >
            +
          </button>
        </div>

        {/* ════════════════════════════════════════════ */}
        {/* 전체 보기 모드: 모든 시술을 한 화면에 쭉 표시 */}
        {/* ════════════════════════════════════════════ */}
        {viewAll ? (
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow border border-gray-300 p-4 sm:p-6">
            {/* 전체 보기 헤더 */}
            <div className="flex items-center justify-between mb-4 print:hidden">
              <h2 className="text-base font-bold text-gray-800">
                📋 전체 시술 가격표 ({items.length}개)
              </h2>
              <span className="text-xs text-gray-400">
                각 시술을 접을 수 있습니다
              </span>
            </div>

            {/* 인쇄용 헤더 */}
            <div className="hidden print:block mb-4">
              <h2 className="text-xl font-bold text-center border-b-2 border-gray-800 pb-2">
                VANS Clinic 이벤트 가격표
              </h2>
              <p className="text-right text-sm text-gray-500 mt-1">
                {new Date().toLocaleDateString('ko-KR')} | 반올림: {roundUnit.toLocaleString()}원 단위
              </p>
            </div>

            {items.map((item, idx) => {
              const result = computedResults[idx];
              return (
                <div
                  key={item.id}
                  className={`${idx > 0 ? 'mt-6 pt-6 border-t-2 border-gray-200' : ''}`}
                >
                  {/* 시술 헤더 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: 'var(--color-event)' }}
                    >
                      {idx + 1}
                    </span>
                    <h3 className="text-base font-bold text-gray-800">
                      {item.name || `시술 ${item.id}`}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {item.type === 'session' ? '회차 기반' : item.type === 'shot' ? '샷수 기반' : '혼합형'}
                    </span>
                  </div>

                  {/* 입력 폼 (인쇄 시 숨김) */}
                  <div className="print:hidden mb-4">
                    <ItemForm
                      item={item}
                      onChange={(updated) => updateItem(idx, updated)}
                    />
                  </div>

                  {/* 결과 테이블 */}
                  {result && result.rows.length > 0 && (
                    <div className="mt-3">
                      <ResultTable
                        rows={result.rows}
                        type={result.type}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ════════════════════════════════════════ */
          /* 개별 탭 모드 (기존 동작)                  */
          /* ════════════════════════════════════════ */
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow border border-gray-300 p-4 sm:p-6">
            {/* 입력 폼 (인쇄 시 숨김) */}
            <div className="print:hidden">
              {items[activeTab] && (
                <ItemForm
                  item={items[activeTab]}
                  onChange={(updated) => updateItem(activeTab, updated)}
                />
              )}
            </div>

            {/* 결과 테이블 */}
            {activeResult && activeResult.rows.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-700 mb-2 print:text-lg">
                  📊 {activeResult.name} 계산 결과
                </h3>
                <ResultTable
                  rows={activeResult.rows}
                  type={activeResult.type}
                />
              </div>
            )}

            {/* 인쇄 시 다른 탭 결과도 표시 */}
            <div className="hidden print:block">
              {computedResults.map((result, idx) => {
                if (idx === activeTab) return null;
                if (!result.rows || result.rows.length === 0) return null;
                return (
                  <div key={idx} className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      📊 {result.name} 계산 결과
                    </h3>
                    <ResultTable rows={result.rows} type={result.type} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 하단 도구 바 (인쇄 시 숨김) */}
        <div className="mt-4 space-y-4 print:hidden">
          {/* 내보내기 버튼 */}
          <ExportButtons
            items={computedResults}
            roundUnit={roundUnit}
            onToast={showToast}
          />

          {/* 프리셋 관리 */}
          <PresetManager
            currentData={{ items, activeTab }}
            onLoad={replaceAllData}
            onToast={showToast}
          />
        </div>
      </main>

      {/* 토스트 알림 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg
                        text-sm font-medium animate-bounce-in">
          {toast}
        </div>
      )}
    </div>
  );
}
