/**
 * MainApp.jsx - 최상위 앱 셸
 *
 * 2탭 구조: 수가 책정 | 한정 이벤트
 */

import { useState, useCallback, useEffect } from 'react';
import Header from './Header';
import MainTabBar from './MainTabBar';
import Toast from './Toast';
import PricingTab from './pricing/PricingTab';
import EventTab from './event/EventTab';
import BranchTab from './branch/BranchTab';
import { autoLoad, saveRoundUnit, loadRoundUnit } from '../utils/storage';

export default function MainApp() {
  const [mainTab, setMainTab] = useState('pricing');
  const [roundUnit, setRoundUnit] = useState(() => loadRoundUnit());
  const [toast, setToast] = useState(null);

  // 기존 데이터 로드 (PricingTab에 전달)
  const [initialPricingData] = useState(() => autoLoad());

  // 반올림 단위 저장
  useEffect(() => {
    saveRoundUnit(roundUnit);
  }, [roundUnit]);

  const showToast = useCallback((msg) => setToast(msg), []);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header roundUnit={roundUnit} onRoundUnitChange={setRoundUnit} />

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* 메인 탭 */}
        <MainTabBar activeTab={mainTab} onTabChange={setMainTab} />

        {/* 탭 컨텐츠 */}
        <div className="mt-0">
          {mainTab === 'pricing' && (
            <PricingTab
              roundUnit={roundUnit}
              onToast={showToast}
              initialData={initialPricingData}
            />
          )}
          {mainTab === 'event' && (
            <EventTab onToast={showToast} />
          )}
          {mainTab === 'branch' && (
            <BranchTab onToast={showToast} />
          )}
        </div>
      </main>

      <Toast message={toast} onClose={clearToast} />
    </div>
  );
}
