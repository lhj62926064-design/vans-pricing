/**
 * EventTab.jsx - 한정 이벤트 패키지 탭
 */

import { useState, useCallback, useMemo } from 'react';
import ProcedureLibrary from './ProcedureLibrary';
import PackageBuilder from './PackageBuilder';
import PackageList from './PackageList';
import PackageExport from './PackageExport';
import { computePackageSummary } from '../../utils/packagePricing';

export default function EventTab({ onToast }) {
  // 시술 라이브러리
  const [procedures, setProcedures] = useState(() => {
    try {
      const raw = localStorage.getItem('vans-pricing-procedures');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // 패키지 목록
  const [packages, setPackages] = useState(() => {
    try {
      const raw = localStorage.getItem('vans-pricing-packages');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // 현재 편집 중인 패키지
  const [editingPackage, setEditingPackage] = useState(null);

  // 시술 라이브러리 저장
  const saveProcedures = useCallback((updated) => {
    setProcedures(updated);
    try {
      localStorage.setItem('vans-pricing-procedures', JSON.stringify(updated));
    } catch (err) {
      console.error('시술 저장 실패:', err);
    }
  }, []);

  // 패키지 저장
  const savePackages = useCallback((updated) => {
    setPackages(updated);
    try {
      localStorage.setItem('vans-pricing-packages', JSON.stringify(updated));
    } catch (err) {
      console.error('패키지 저장 실패:', err);
    }
  }, []);

  // 시술 추가/수정
  const handleSaveProcedure = useCallback((procedure) => {
    saveProcedures(
      procedure.id
        ? procedures.map((p) => (p.id === procedure.id ? procedure : p))
        : [...procedures, { ...procedure, id: Date.now(), createdAt: new Date().toISOString() }]
    );
    onToast?.('시술이 저장되었습니다');
  }, [procedures, saveProcedures, onToast]);

  // 시술 삭제
  const handleDeleteProcedure = useCallback((id) => {
    if (!window.confirm('이 시술을 삭제하시겠습니까?')) return;
    saveProcedures(procedures.filter((p) => p.id !== id));
    onToast?.('시술이 삭제되었습니다');
  }, [procedures, saveProcedures, onToast]);

  // 패키지 저장
  const handleSavePackage = useCallback((pkg) => {
    const exists = packages.find((p) => p.id === pkg.id);
    if (exists) {
      savePackages(packages.map((p) => (p.id === pkg.id ? pkg : p)));
    } else {
      savePackages([...packages, { ...pkg, id: Date.now(), createdAt: new Date().toISOString() }]);
    }
    setEditingPackage(null);
    onToast?.('패키지가 저장되었습니다');
  }, [packages, savePackages, onToast]);

  // 패키지 삭제
  const handleDeletePackage = useCallback((id) => {
    if (!window.confirm('이 패키지를 삭제하시겠습니까?')) return;
    savePackages(packages.filter((p) => p.id !== id));
    onToast?.('패키지가 삭제되었습니다');
  }, [packages, savePackages, onToast]);

  // 패키지 요약 계산
  const packageSummaries = useMemo(() => {
    return packages.map((pkg) => ({
      ...pkg,
      summary: computePackageSummary(pkg),
    }));
  }, [packages]);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 시술 라이브러리 */}
        <div>
          <ProcedureLibrary
            procedures={procedures}
            onSave={handleSaveProcedure}
            onDelete={handleDeleteProcedure}
          />
        </div>

        {/* 오른쪽: 패키지 구성 */}
        <div>
          <PackageBuilder
            procedures={procedures}
            editingPackage={editingPackage}
            onSave={handleSavePackage}
            onCancel={() => setEditingPackage(null)}
          />
        </div>
      </div>

      {/* 하단: 저장된 패키지 목록 */}
      {packages.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <PackageList
            packages={packageSummaries}
            onEdit={setEditingPackage}
            onDelete={handleDeletePackage}
          />
        </div>
      )}

      {/* 내보내기 */}
      {packages.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <PackageExport packages={packageSummaries} onToast={onToast} />
        </div>
      )}
    </div>
  );
}
