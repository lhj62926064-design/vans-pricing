/**
 * BranchTab.jsx - 지점 수가 라이브러리 탭
 *
 * 구성:
 *   - CSV 가져오기 (접이식)
 *   - 지점 선택 + 시술 검색/필터 테이블
 *   - 지점간 가격 비교 (접이식)
 *   - 데이터 백업/복원
 *   - 저장 현황
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import BranchImport from './BranchImport';
import BranchSelector from './BranchSelector';
import BranchProcedureList from './BranchProcedureList';
import BranchComparison from './BranchComparison';
import {
  getActiveBranch, setActiveBranch,
  loadBranchData, saveBranchData, deleteBranchData, deleteAllBranchData,
  getBranchStorageStats, loadManifest, invalidateCache,
} from '../../utils/branchStorage';

export default function BranchTab({ onToast }) {
  const [activeBranch, setActiveBranchState] = useState(() => getActiveBranch());
  const [showImport, setShowImport] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const restoreFileRef = useRef(null);

  const branchData = useMemo(
    () => loadBranchData(activeBranch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeBranch, refreshKey],
  );

  const stats = useMemo(
    () => getBranchStorageStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const manifest = useMemo(
    () => loadManifest(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const handleBranchChange = useCallback((name) => {
    setActiveBranchState(name);
    setActiveBranch(name);
  }, []);

  const handleImported = useCallback((branchName) => {
    setActiveBranchState(branchName);
    setActiveBranch(branchName);
    setShowImport(false);
    setRefreshKey((k) => k + 1);
  }, []);

  // 지점 삭제 (Undo 지원)
  const handleDeleteBranch = useCallback(() => {
    if (!activeBranch) return;
    const backupData = loadBranchData(activeBranch);
    const backupName = activeBranch;
    deleteBranchData(activeBranch);
    setActiveBranchState(getActiveBranch());
    setRefreshKey((k) => k + 1);
    onToast?.(`${backupName} 지점 데이터가 삭제되었습니다`, () => {
      // Undo: 복원
      saveBranchData(backupName, backupData);
      setActiveBranchState(backupName);
      setActiveBranch(backupName);
      setRefreshKey((k) => k + 1);
      onToast?.(`${backupName} 지점 데이터가 복원되었습니다`);
    });
  }, [activeBranch, onToast]);

  // 전체 삭제 (Undo 지원)
  const handleDeleteAll = useCallback(() => {
    if (!window.confirm('모든 지점 데이터를 삭제하시겠습니까?')) return;
    // 백업
    const currentManifest = loadManifest();
    const allBackup = {};
    for (const branch of currentManifest.branches) {
      allBackup[branch.name] = loadBranchData(branch.name);
    }
    deleteAllBranchData();
    setActiveBranchState(null);
    setRefreshKey((k) => k + 1);
    onToast?.('모든 지점 데이터가 삭제되었습니다', () => {
      // Undo: 모두 복원
      for (const [name, data] of Object.entries(allBackup)) {
        saveBranchData(name, data);
      }
      const firstBranch = Object.keys(allBackup)[0] || null;
      if (firstBranch) {
        setActiveBranchState(firstBranch);
        setActiveBranch(firstBranch);
      }
      setRefreshKey((k) => k + 1);
      onToast?.('모든 지점 데이터가 복원되었습니다');
    });
  }, [onToast]);

  // ── 데이터 백업 (JSON 내보내기) ──
  const handleBackup = useCallback(() => {
    const currentManifest = loadManifest();
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      manifest: currentManifest,
      branches: {},
      // 이벤트 데이터도 포함
      procedures: null,
      packages: null,
    };
    for (const branch of currentManifest.branches) {
      backup.branches[branch.name] = loadBranchData(branch.name);
    }
    // 시술 라이브러리 + 패키지도 백업
    try {
      const procs = localStorage.getItem('vans-pricing-procedures');
      if (procs) backup.procedures = JSON.parse(procs);
    } catch {}
    try {
      const pkgs = localStorage.getItem('vans-pricing-packages');
      if (pkgs) backup.packages = JSON.parse(pkgs);
    } catch {}

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vans-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.('전체 데이터가 백업되었습니다');
  }, [onToast]);

  // ── 데이터 복원 (JSON 가져오기) ──
  const handleRestore = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup.manifest || !backup.branches) {
          onToast?.('유효하지 않은 백업 파일입니다');
          return;
        }
        if (!window.confirm(
          `백업 파일에 ${Object.keys(backup.branches).length}개 지점 데이터가 있습니다.\n기존 데이터를 덮어쓰시겠습니까?`
        )) return;

        // 지점 데이터 복원
        for (const [name, data] of Object.entries(backup.branches)) {
          saveBranchData(name, data);
        }
        // 시술 라이브러리 복원
        if (backup.procedures) {
          try { localStorage.setItem('vans-pricing-procedures', JSON.stringify(backup.procedures)); } catch {}
        }
        // 패키지 복원
        if (backup.packages) {
          try { localStorage.setItem('vans-pricing-packages', JSON.stringify(backup.packages)); } catch {}
        }

        const firstName = Object.keys(backup.branches)[0] || null;
        if (firstName) {
          setActiveBranchState(firstName);
          setActiveBranch(firstName);
        }
        invalidateCache();
        setRefreshKey((k) => k + 1);
        onToast?.(`${Object.keys(backup.branches).length}개 지점 데이터가 복원되었습니다`);
      } catch (err) {
        onToast?.(`복원 실패: ${err.message}`);
      }
    };
    reader.readAsText(file);
    // 같은 파일 재선택 허용
    if (restoreFileRef.current) restoreFileRef.current.value = '';
  }, [onToast]);

  // 활성 지점 정보
  const activeBranchInfo = manifest.branches.find((b) => b.name === activeBranch);

  return (
    <div className="space-y-4">
      {/* 상단: 헤더 + CSV 가져오기 */}
      <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">
            지점 수가 라이브러리
          </h2>
          <button
            onClick={() => setShowImport(!showImport)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border
              ${showImport
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-teal-600 border-teal-300 hover:bg-teal-50'
              }`}
          >
            {showImport ? 'CSV 가져오기 닫기' : 'CSV 가져오기'}
          </button>
        </div>

        {/* CSV 가져오기 (접이식) */}
        {showImport && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <BranchImport onImported={handleImported} onToast={onToast} />
          </div>
        )}

        {/* 지점 선택 */}
        {stats.totalBranches > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector value={activeBranch} onChange={handleBranchChange} />

            {activeBranchInfo && (
              <span className="text-xs text-gray-400">
                {activeBranchInfo.rowCount}개 항목
                {' | '}
                {new Date(activeBranchInfo.importedAt).toLocaleDateString('ko-KR')} 가져옴
              </span>
            )}

            {activeBranch && (
              <button
                onClick={handleDeleteBranch}
                className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto"
              >
                이 지점 삭제
              </button>
            )}
          </div>
        )}

        {stats.totalBranches === 0 && !showImport && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-3">
              아직 가져온 지점 수가표가 없습니다
            </p>
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded
                         hover:bg-teal-700 transition-colors"
            >
              CSV 수가표 가져오기
            </button>
          </div>
        )}
      </div>

      {/* 시술 목록 */}
      {activeBranch && branchData.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            {activeBranch} 수가표
          </h3>
          <BranchProcedureList
            data={branchData}
            branchName={activeBranch}
            onToast={onToast}
          />
        </div>
      )}

      {/* 지점간 비교 */}
      {stats.totalBranches >= 2 && (
        <div className="bg-white rounded-lg shadow border border-gray-300 p-4 sm:p-6">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="flex items-center gap-2 text-sm font-bold text-gray-700 w-full text-left"
          >
            <span className={`transition-transform ${showComparison ? 'rotate-90' : ''}`}>
              ▶
            </span>
            지점간 가격 비교
          </button>

          {showComparison && (
            <div className="mt-4">
              <BranchComparison onToast={onToast} />
            </div>
          )}
        </div>
      )}

      {/* 저장 현황 + 백업/복원 */}
      {stats.totalBranches > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gray-100 rounded-lg text-xs text-gray-500">
          <span>
            {stats.totalBranches}개 지점 | {stats.totalRows}개 항목 | ~{stats.estimatedSizeKB}KB
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackup}
              className="text-teal-600 hover:text-teal-800 font-medium transition-colors"
            >
              백업
            </button>
            <label className="text-teal-600 hover:text-teal-800 font-medium transition-colors cursor-pointer">
              복원
              <input
                ref={restoreFileRef}
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="hidden"
              />
            </label>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleDeleteAll}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              전체 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
