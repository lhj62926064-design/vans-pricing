/**
 * EventTab.jsx - 한정 이벤트 패키지 탭 (벌크 입력 방식)
 *
 * 워크플로우:
 *   1. 텍스트 붙여넣기 (GPT처럼) → 자동 파싱
 *   2. 시술 라이브러리에서 정가 자동 매칭
 *   3. 목표 할인율 설정 → 패키지가 자동 계산 (또는 직접 입력)
 *   4. 개별 시술 할인율 조절 가능
 *   5. 카톡/엑셀 내보내기
 *
 * 추가 기능:
 *   - 빈 패키지 추가 버튼
 *   - 작업 중 패키지 순서 변경 (↑↓)
 *   - 반올림 단위 연동 (Header)
 *   - 목표 할인율 적용 피드백
 *   - 최근 사용 시술 추천
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import BulkPackageInput from './BulkPackageInput';
import PackageCard from './PackageCard';
import ProcedureLibrary from './ProcedureLibrary';
import PackageExport from './PackageExport';
import PackageArchive, { addToArchive } from './PackageArchive';
import BranchSelector from '../branch/BranchSelector';
import { computePackageSummary, calcPackagePriceFromDiscount } from '../../utils/packagePricing';
import { formatNumber } from '../../utils/pricing';
import { getActiveBranch, setActiveBranch, loadBranchData } from '../../utils/branchStorage';

export default function EventTab({ onToast, roundUnit = 10000 }) {
  // 지점 수가 연동
  const [activeBranch, setActiveBranchState] = useState(() => getActiveBranch());
  const branchProcedures = useMemo(() => {
    if (!activeBranch) return [];
    return loadBranchData(activeBranch);
  }, [activeBranch]);

  const handleBranchChange = useCallback((branch) => {
    setActiveBranchState(branch);
    setActiveBranch(branch);
  }, []);

  // 시술 라이브러리
  const [procedures, setProcedures] = useState(() => {
    try {
      const raw = localStorage.getItem('vans-pricing-procedures');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // 파싱된 패키지 (작업 중) - 임시저장 복원
  const [packages, setPackages] = useState(() => {
    try {
      const draft = localStorage.getItem('vans-pricing-draft-packages');
      return draft ? JSON.parse(draft) : [];
    } catch { return []; }
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // 임시저장 자동 저장 (디바운스 2초)
  useEffect(() => {
    if (packages.length === 0) {
      try { localStorage.removeItem('vans-pricing-draft-packages'); } catch {}
      return;
    }
    const timer = setTimeout(() => {
      try { localStorage.setItem('vans-pricing-draft-packages', JSON.stringify(packages)); } catch {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [packages]);

  // 임시저장 복원 알림 (최초 1회)
  useEffect(() => {
    if (!draftRestored && packages.length > 0) {
      setDraftRestored(true);
      onToast?.(`임시 저장된 패키지 ${packages.length}개를 불러왔습니다`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 저장된 패키지
  const [savedPackages, setSavedPackages] = useState(() => {
    try {
      const raw = localStorage.getItem('vans-pricing-packages');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // 목표 할인율
  const [targetDiscount, setTargetDiscount] = useState('30');

  // 시술 라이브러리 표시 토글
  const [showLibrary, setShowLibrary] = useState(false);

  // 저장된 패키지 검색 쿼리
  const [packageQuery, setPackageQuery] = useState('');

  // 할인율 적용 피드백
  const [discountFeedback, setDiscountFeedback] = useState(null);

  // ── 시술 라이브러리 관리 ──
  const saveProcedures = useCallback((updated) => {
    setProcedures(updated);
    try {
      localStorage.setItem('vans-pricing-procedures', JSON.stringify(updated));
    } catch (err) {
      console.error('시술 저장 실패:', err);
    }
  }, []);

  const handleSaveProcedure = useCallback((procedure) => {
    saveProcedures(
      procedure.id
        ? procedures.map((p) => (p.id === procedure.id ? procedure : p))
        : [...procedures, { ...procedure, id: Date.now(), createdAt: new Date().toISOString() }]
    );
    onToast?.('시술이 저장되었습니다');
  }, [procedures, saveProcedures, onToast]);

  const handleDeleteProcedure = useCallback((id) => {
    if (!window.confirm('이 시술을 삭제하시겠습니까?')) return;
    saveProcedures(procedures.filter((p) => p.id !== id));
    onToast?.('시술이 삭제되었습니다');
  }, [procedures, saveProcedures, onToast]);

  // ── 벌크 파싱 결과 수신 ──
  const handleParsed = useCallback((parsed) => {
    if (parsed.length === 0) {
      onToast?.('파싱할 패키지가 없습니다');
      return;
    }
    setPackages((prev) => [...prev, ...parsed]);
    onToast?.(`${parsed.length}개 패키지가 파싱되었습니다`);
  }, [onToast]);

  // ── 빈 패키지 추가 ──
  const addEmptyPackage = useCallback(() => {
    const newPkg = {
      id: Date.now() + Math.random(),
      name: '',
      packagePrice: 0,
      items: [{ procedureName: '', quantity: 1, individualPrice: 0, priceSource: 'manual' }],
    };
    setPackages((prev) => [...prev, newPkg]);
  }, []);

  // ── 개별 패키지 수정 ──
  const updatePackage = useCallback((idx, updated) => {
    setPackages((prev) => prev.map((p, i) => (i === idx ? updated : p)));
  }, []);

  const removePackage = useCallback((idx) => {
    setPackages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const duplicatePackage = useCallback((idx) => {
    setPackages((prev) => {
      const source = prev[idx];
      const clone = { ...source, id: Date.now() + Math.random(), name: source.name + ' (복사)', items: source.items.map(i => ({...i})) };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
    onToast?.('패키지가 복제되었습니다');
  }, [onToast]);

  // ── 작업 중 패키지 순서 변경 ──
  const movePackage = useCallback((index, direction) => {
    const newIndex = index + direction;
    setPackages((prev) => {
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  }, []);

  // ── 목표 할인율로 전체 자동 계산 (피드백 포함) ──
  const applyTargetDiscount = useCallback(() => {
    const discount = Number(targetDiscount) || 0;
    if (discount <= 0 || discount >= 100) {
      onToast?.('할인율은 1~99% 사이로 입력하세요');
      return;
    }

    // 변경 전 상태 기록
    const beforePrices = packages.map((p) => Number(p.packagePrice) || 0);
    let changedCount = 0;
    let totalBefore = 0;
    let totalAfter = 0;

    const updatedPackages = packages.map((pkg, idx) => {
      const newPrice = calcPackagePriceFromDiscount(pkg, discount, roundUnit);
      if (newPrice > 0) {
        totalBefore += beforePrices[idx];
        totalAfter += newPrice;
        if (newPrice !== beforePrices[idx]) changedCount++;
        return { ...pkg, packagePrice: newPrice };
      }
      return pkg;
    });

    setPackages(updatedPackages);

    // 피드백 생성
    if (changedCount > 0) {
      const diff = totalBefore - totalAfter;
      setDiscountFeedback({
        discount,
        changedCount,
        totalCount: packages.length,
        totalBefore,
        totalAfter,
        diff,
        roundUnit,
      });
      // 5초 후 자동 숨김
      setTimeout(() => setDiscountFeedback(null), 5000);
    }

    onToast?.(`전체 패키지에 ${discount}% 할인율이 적용되었습니다 (반올림: ${formatNumber(roundUnit)}원 단위)`);
  }, [targetDiscount, packages, roundUnit, onToast]);

  // ── 전체 저장 ──
  const saveAllPackages = useCallback(() => {
    const valid = packages.filter((p) => p.name && p.packagePrice > 0);
    if (valid.length === 0) {
      onToast?.('저장할 패키지가 없습니다 (이름과 가격이 필요합니다)');
      return;
    }
    const now = new Date().toISOString();
    const toSave = valid.map((p) => ({
      ...p,
      id: p.id || Date.now() + Math.random(),
      createdAt: p.createdAt || now,
    }));
    const merged = [...savedPackages, ...toSave];
    setSavedPackages(merged);
    try {
      localStorage.setItem('vans-pricing-packages', JSON.stringify(merged));
    } catch (err) {
      console.error('패키지 저장 실패:', err);
    }
    setPackages([]);
    try { localStorage.removeItem('vans-pricing-draft-packages'); } catch {}
    onToast?.(`${valid.length}개 패키지가 저장되었습니다`);
  }, [packages, savedPackages, onToast]);

  // ── 저장된 패키지 삭제 ──
  const deleteSavedPackage = useCallback((id) => {
    if (!window.confirm('이 패키지를 삭제하시겠습니까?')) return;
    const updated = savedPackages.filter((p) => p.id !== id);
    setSavedPackages(updated);
    try {
      localStorage.setItem('vans-pricing-packages', JSON.stringify(updated));
    } catch (err) {
      console.error('패키지 삭제 실패:', err);
    }
    onToast?.('패키지가 삭제되었습니다');
  }, [savedPackages, onToast]);

  // ── 저장된 패키지 다시 편집 ──
  const editSavedPackages = useCallback(() => {
    setPackages(savedPackages);
    setSavedPackages([]);
    try {
      localStorage.removeItem('vans-pricing-packages');
    } catch {}
    onToast?.('저장된 패키지를 편집 모드로 불러왔습니다');
  }, [savedPackages, onToast]);

  // ── 저장된 패키지에 전체 초기화 ──
  const clearSavedPackages = useCallback(() => {
    if (!window.confirm('저장된 패키지를 모두 삭제하시겠습니까?')) return;
    setSavedPackages([]);
    try {
      localStorage.removeItem('vans-pricing-packages');
    } catch {}
    onToast?.('저장된 패키지가 모두 삭제되었습니다');
  }, [onToast]);

  // ── 저장된 패키지 순서 변경 ──
  const moveSavedPackage = useCallback((index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= savedPackages.length) return;
    const updated = [...savedPackages];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSavedPackages(updated);
    try {
      localStorage.setItem('vans-pricing-packages', JSON.stringify(updated));
    } catch {}
  }, [savedPackages]);

  // ── 저장된 패키지 개별 수정 ──
  const editSinglePackage = useCallback((id) => {
    const pkg = savedPackages.find((p) => p.id === id);
    if (!pkg) return;
    setPackages((prev) => [...prev, { ...pkg, items: pkg.items.map(i => ({...i})) }]);
    const updated = savedPackages.filter((p) => p.id !== id);
    setSavedPackages(updated);
    try {
      localStorage.setItem('vans-pricing-packages', JSON.stringify(updated));
    } catch {}
    onToast?.('패키지를 편집 모드로 불러왔습니다');
  }, [savedPackages, onToast]);

  // ── 아카이브에 저장 ──
  const archivePackages = useCallback(() => {
    if (savedPackages.length === 0) return;
    const groupName = window.prompt('아카이브 대분류명을 입력하세요\n(예: 1월 한정이벤트, 2월 프로모션)',
      new Date().toLocaleDateString('ko-KR') + ' 이벤트');
    if (!groupName) return;
    addToArchive(groupName, savedPackages, '자사', activeBranch || 'VANS');
    onToast?.(`${savedPackages.length}개 패키지가 아카이브에 저장되었습니다`);
  }, [savedPackages, activeBranch, onToast]);

  // 패키지 요약 (내보내기용)
  const packageSummaries = useMemo(() => {
    return savedPackages.map((pkg) => ({
      ...pkg,
      summary: computePackageSummary(pkg),
    }));
  }, [savedPackages]);

  // 저장된 패키지 필터링
  const filteredSavedPackages = useMemo(() => {
    if (!packageQuery.trim()) return savedPackages;
    const q = packageQuery.replace(/\s+/g, '').toLowerCase();
    return savedPackages.filter((pkg) => {
      if (pkg.name?.replace(/\s+/g, '').toLowerCase().includes(q)) return true;
      if (pkg.items?.some((item) => item.procedureName?.replace(/\s+/g, '').toLowerCase().includes(q))) return true;
      return false;
    });
  }, [savedPackages, packageQuery]);

  // 작업 중 패키지 요약 통계
  const workingStats = useMemo(() => {
    if (packages.length === 0) return null;
    const withPrice = packages.filter((p) => p.packagePrice > 0);
    const total = withPrice.reduce((s, p) => s + Number(p.packagePrice), 0);
    const totalVat = Math.round(total * 1.1);
    return { total: packages.length, priced: withPrice.length, totalPrice: total, totalPriceVat: totalVat };
  }, [packages]);

  // ── 패키지 카드 영역 리사이즈 ──
  const [cardAreaHeight, setCardAreaHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('vans-pricing-card-container-height');
      return saved ? Number(saved) : 0; // 0 = auto (기본 500px)
    } catch { return 0; }
  });
  const cardAreaRef = useRef(null);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = cardAreaRef.current?.offsetHeight || 500;

    const handleMove = (ev) => {
      const newH = Math.max(200, Math.min(window.innerHeight - 200, startH + (ev.clientY - startY)));
      setCardAreaHeight(newH);
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setCardAreaHeight((h) => {
        try { localStorage.setItem('vans-pricing-card-container-height', String(h)); } catch {}
        return h;
      });
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);

  const resetCardAreaHeight = useCallback(() => {
    setCardAreaHeight(0);
    try { localStorage.removeItem('vans-pricing-card-container-height'); } catch {}
  }, []);

  return (
    <div className="space-y-4">
      {/* 상단: 벌크 입력 + 시술 라이브러리 토글 */}
      <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">
            한정 이벤트 패키지
          </h2>
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border
              ${showLibrary
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'
              }`}
          >
            {showLibrary ? '시술 라이브러리 닫기' : '시술 라이브러리 관리'}
          </button>
        </div>

        {/* 시술 라이브러리 (접이식) */}
        {showLibrary && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <ProcedureLibrary
              procedures={procedures}
              onSave={handleSaveProcedure}
              onDelete={handleDeleteProcedure}
            />
            <p className="text-xs text-gray-400 mt-3">
              여기에 등록된 시술은 패키지 텍스트 입력 시 정가가 자동으로 매칭됩니다.
            </p>
          </div>
        )}

        {/* 지점 수가 연동 */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
          <span className="text-xs text-gray-500 shrink-0">지점 수가 연동:</span>
          <BranchSelector value={activeBranch} onChange={handleBranchChange} size="sm" />
          {activeBranch && branchProcedures.length > 0 && (
            <span className="text-xs text-teal-600 font-medium">
              {branchProcedures.length}개 항목 연동 중
            </span>
          )}
        </div>

        {/* 벌크 텍스트 입력 + 새 패키지 버튼 */}
        <BulkPackageInput
          procedures={procedures}
          branchProcedures={branchProcedures}
          onParsed={handleParsed}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={addEmptyPackage}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200
                       rounded-lg hover:bg-indigo-100 transition-colors"
          >
            + 새 패키지
          </button>
          {packages.length > 0 && (
            <span className="text-xs text-gray-400">
              작업 중 {packages.length}개
            </span>
          )}
        </div>
      </div>

      {/* 파싱 결과: 패키지 카드들 */}
      {packages.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
          {/* 일괄 설정 바 */}
          <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">목표 할인율 (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={targetDiscount}
                  onChange={(e) => setTargetDiscount(e.target.value)}
                  min="1"
                  max="99"
                  className="w-20 px-2.5 py-2 border border-indigo-300 rounded text-sm font-bold text-center
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={applyTargetDiscount}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded
                             hover:bg-indigo-700 transition-colors"
                >
                  전체 적용
                </button>
              </div>
            </div>

            {/* 반올림 단위 표시 */}
            <div className="text-xs text-gray-400 pb-2">
              반올림: {formatNumber(roundUnit)}원 단위
            </div>

            <div className="flex-1" />

            {workingStats && (
              <div className="text-right text-xs text-gray-500">
                <span className="font-medium">{workingStats.total}개</span> 패키지
                {workingStats.priced > 0 && (
                  <>
                    {' '} | 가격 설정 <span className="font-bold text-indigo-600">{workingStats.priced}개</span>
                    {' '} | 합계 <span className="font-bold text-indigo-600">{formatNumber(workingStats.totalPrice)}원</span>
                    <span className="text-gray-400 ml-1">(VAT 포함 {formatNumber(workingStats.totalPriceVat)}원)</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 할인율 적용 피드백 */}
          {discountFeedback && (
            <div className="mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 space-y-0.5">
              <div className="font-bold">할인율 {discountFeedback.discount}% 적용 결과</div>
              <div>
                변경된 패키지: <span className="font-bold">{discountFeedback.changedCount}</span>/{discountFeedback.totalCount}개
                {discountFeedback.totalBefore > 0 && (
                  <> | 합계: {formatNumber(discountFeedback.totalBefore)}원 &rarr; <span className="font-bold">{formatNumber(discountFeedback.totalAfter)}원</span>
                    {discountFeedback.diff !== 0 && (
                      <span className={discountFeedback.diff > 0 ? ' text-green-600' : ' text-red-500'}>
                        {' '}({discountFeedback.diff > 0 ? '-' : '+'}{formatNumber(Math.abs(discountFeedback.diff))}원)
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="text-gray-500">반올림 단위: {formatNumber(discountFeedback.roundUnit)}원</div>
            </div>
          )}

          {/* 패키지 카드 그리드 (리사이즈 가능) */}
          <div
            ref={cardAreaRef}
            className="space-y-3 overflow-y-auto overscroll-contain"
            style={{ maxHeight: cardAreaHeight || 500, minHeight: 200 }}
          >
            {packages.map((pkg, idx) => (
              <PackageCard
                key={pkg.id || idx}
                pkg={pkg}
                index={idx}
                onChange={(updated) => updatePackage(idx, updated)}
                onRemove={() => removePackage(idx)}
                onDuplicate={() => duplicatePackage(idx)}
                onMoveUp={idx > 0 ? () => movePackage(idx, -1) : undefined}
                onMoveDown={idx < packages.length - 1 ? () => movePackage(idx, 1) : undefined}
                branchProcedures={branchProcedures}
                activeBranch={activeBranch}
                roundUnit={roundUnit}
              />
            ))}
          </div>

          {/* 리사이즈 드래그 핸들 */}
          <div
            className="resize-handle-y flex items-center justify-center py-1 -mx-4 sm:-mx-6 px-4 sm:px-6
                       hover:bg-gray-100 transition-colors group border-t border-gray-100"
            onMouseDown={handleResizeStart}
            title="드래그하여 높이 조절"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gray-300 rounded-full group-hover:bg-indigo-400 transition-colors" />
              <span className="text-[10px] text-gray-400 group-hover:text-indigo-500 transition-colors select-none">
                {cardAreaHeight > 0 ? `${Math.round(cardAreaHeight)}px` : '자동'}
              </span>
              <div className="w-8 h-0.5 bg-gray-300 rounded-full group-hover:bg-indigo-400 transition-colors" />
            </div>
            {cardAreaHeight > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); resetCardAreaHeight(); }}
                className="ml-2 text-[10px] text-gray-400 hover:text-indigo-600 transition-colors"
                title="높이 자동으로 되돌리기"
              >
                초기화
              </button>
            )}
          </div>

          {/* 하단 액션 */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={addEmptyPackage}
              className="px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition-colors font-medium"
            >
              + 패키지 추가
            </button>
            <button
              onClick={() => { setPackages([]); try { localStorage.removeItem('vans-pricing-draft-packages'); } catch {} }}
              className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              초기화
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.setItem('vans-pricing-draft-packages', JSON.stringify(packages));
                  onToast?.('임시 저장되었습니다');
                } catch {}
              }}
              className="px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors font-medium"
            >
              💾 임시저장
            </button>
            <div className="flex-1" />
            <button
              onClick={saveAllPackages}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg
                         hover:bg-blue-700 transition-colors"
            >
              전체 저장 ({packages.filter((p) => p.name && p.packagePrice > 0).length}개)
            </button>
          </div>
        </div>
      )}

      {/* 저장된 패키지 목록 */}
      {savedPackages.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">
              저장된 패키지 ({savedPackages.length}개)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={archivePackages}
                className="text-xs px-3 py-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors font-medium"
              >
                아카이브 저장
              </button>
              <button
                onClick={editSavedPackages}
                className="text-xs px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              >
                다시 편집
              </button>
              <button
                onClick={clearSavedPackages}
                className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                전체 삭제
              </button>
            </div>
          </div>

          {savedPackages.length > 3 && (
            <div className="mb-3">
              <input
                type="text"
                value={packageQuery}
                onChange={(e) => setPackageQuery(e.target.value)}
                placeholder="패키지명 또는 시술명 검색..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {packageQuery && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {filteredSavedPackages.length}/{savedPackages.length}개 표시
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            {filteredSavedPackages.map((pkg) => {
              const idx = savedPackages.indexOf(pkg);
              const s = computePackageSummary(pkg);
              return (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-gray-800">{pkg.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {pkg.items?.map((i) => i.procedureName).join(' + ')}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs">
                      {s.totalRegularPrice > 0 && (
                        <span className="text-gray-500">정가 {formatNumber(s.totalRegularPrice)}원</span>
                      )}
                      <span className="font-bold text-indigo-700">
                        {formatNumber(pkg.packagePrice)}원
                      </span>
                      {s.savingsPercent > 0 && (
                        <span className="text-green-600 font-bold">
                          {s.savingsPercent}% 할인
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {idx > 0 && (
                      <button
                        onClick={() => moveSavedPackage(idx, -1)}
                        className="text-xs px-1.5 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="위로 이동"
                      >
                        ↑
                      </button>
                    )}
                    {idx < savedPackages.length - 1 && (
                      <button
                        onClick={() => moveSavedPackage(idx, 1)}
                        className="text-xs px-1.5 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="아래로 이동"
                      >
                        ↓
                      </button>
                    )}
                    <button
                      onClick={() => editSinglePackage(pkg.id)}
                      className="text-xs px-2 py-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteSavedPackage(pkg.id)}
                      className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 내보내기 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <PackageExport packages={packageSummaries} onToast={onToast} />
          </div>
        </div>
      )}

      {/* 패키지 아카이브 */}
      <PackageArchive onToast={onToast} />
    </div>
  );
}
