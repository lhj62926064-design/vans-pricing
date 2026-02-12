/**
 * EventTab.jsx - 한정 이벤트 패키지 탭 (벌크 입력 방식)
 *
 * 워크플로우:
 *   1. 텍스트 붙여넣기 (GPT처럼) → 자동 파싱
 *   2. 시술 라이브러리에서 정가 자동 매칭
 *   3. 목표 할인율 설정 → 패키지가 자동 계산 (또는 직접 입력)
 *   4. 카톡/엑셀 내보내기
 */

import { useState, useCallback, useMemo } from 'react';
import BulkPackageInput from './BulkPackageInput';
import PackageCard from './PackageCard';
import ProcedureLibrary from './ProcedureLibrary';
import PackageExport from './PackageExport';
import BranchSelector from '../branch/BranchSelector';
import { computePackageSummary, calcPackagePriceFromDiscount } from '../../utils/packagePricing';
import { formatNumber } from '../../utils/pricing';
import { getActiveBranch, setActiveBranch, loadBranchData } from '../../utils/branchStorage';

export default function EventTab({ onToast }) {
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

  // 파싱된 패키지 (작업 중)
  const [packages, setPackages] = useState([]);

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
    setPackages(parsed);
    onToast?.(`${parsed.length}개 패키지가 파싱되었습니다`);
  }, [onToast]);

  // ── 개별 패키지 수정 ──
  const updatePackage = useCallback((idx, updated) => {
    setPackages((prev) => prev.map((p, i) => (i === idx ? updated : p)));
  }, []);

  const removePackage = useCallback((idx) => {
    setPackages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── 목표 할인율로 전체 자동 계산 ──
  const applyTargetDiscount = useCallback(() => {
    const discount = Number(targetDiscount) || 0;
    if (discount <= 0 || discount >= 100) {
      onToast?.('할인율은 1~99% 사이로 입력하세요');
      return;
    }
    setPackages((prev) =>
      prev.map((pkg) => {
        const newPrice = calcPackagePriceFromDiscount(pkg, discount, 10000);
        return newPrice > 0 ? { ...pkg, packagePrice: newPrice } : pkg;
      }),
    );
    onToast?.(`전체 패키지에 ${discount}% 할인율이 적용되었습니다`);
  }, [targetDiscount, onToast]);

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

  // 패키지 요약 (내보내기용)
  const packageSummaries = useMemo(() => {
    return savedPackages.map((pkg) => ({
      ...pkg,
      summary: computePackageSummary(pkg),
    }));
  }, [savedPackages]);

  // 작업 중 패키지 요약 통계
  const workingStats = useMemo(() => {
    if (packages.length === 0) return null;
    const withPrice = packages.filter((p) => p.packagePrice > 0);
    const total = withPrice.reduce((s, p) => s + Number(p.packagePrice), 0);
    return { total: packages.length, priced: withPrice.length, totalPrice: total };
  }, [packages]);

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

        {/* 벌크 텍스트 입력 */}
        {packages.length === 0 && (
          <BulkPackageInput
            procedures={procedures}
            branchProcedures={branchProcedures}
            onParsed={handleParsed}
          />
        )}
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

            <div className="flex-1" />

            {workingStats && (
              <div className="text-right text-xs text-gray-500">
                <span className="font-medium">{workingStats.total}개</span> 패키지
                {workingStats.priced > 0 && (
                  <>
                    {' '} | 가격 설정 <span className="font-bold text-indigo-600">{workingStats.priced}개</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 패키지 카드 그리드 */}
          <div className="space-y-3">
            {packages.map((pkg, idx) => (
              <PackageCard
                key={pkg.id || idx}
                pkg={pkg}
                index={idx}
                onChange={(updated) => updatePackage(idx, updated)}
                onRemove={() => removePackage(idx)}
              />
            ))}
          </div>

          {/* 하단 액션 */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setPackages([])}
              className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              초기화
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

          <div className="space-y-2">
            {savedPackages.map((pkg) => {
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
                  <button
                    onClick={() => deleteSavedPackage(pkg.id)}
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors shrink-0 ml-2"
                  >
                    삭제
                  </button>
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
    </div>
  );
}
