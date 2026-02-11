/**
 * AutoPricingPanel.jsx - 경쟁사 기반 자동 수가 책정 패널
 *
 * 경쟁사 가격을 입력하면 자동으로 우리 가격을 생성합니다.
 * 규칙: 경쟁사보다 저렴 + 단조 할인 유지
 */

import { useState } from 'react';
import { generateAutoPricing } from '../../utils/pricing';

export default function AutoPricingPanel({ item, roundUnit, onApply }) {
  const [config, setConfig] = useState({
    competitorPrice: '',
    competitorSessions: '1',
    competitorShots: '100',
    competitorDiscount: '10',   // 경쟁사 대비 몇% 저렴하게
    trialMarkup: '15',          // 체험가 = 이벤트가 대비 몇% 비싸게
    tiers: item.type === 'shot' ? '300,600,1000' : '3,5,10',
    minDiscountStep: '1000',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    const compPrice = Number(config.competitorPrice);
    if (!compPrice || compPrice <= 0) return;

    const tiers = config.tiers
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => n > 0);

    const result = generateAutoPricing(
      {
        competitorDiscount: Number(config.competitorDiscount) || 10,
        trialMarkup: Number(config.trialMarkup) || 15,
        sessionTiers: item.type !== 'shot' ? tiers : [1],
        shotTiers: item.type !== 'session' ? tiers : [0],
        minDiscountStep: Number(config.minDiscountStep) || 1000,
      },
      {
        price: compPrice,
        sessions: Number(config.competitorSessions) || 1,
        shots: Number(config.competitorShots) || 100,
      },
      item.type,
      roundUnit,
    );

    onApply(result);
  };

  return (
    <div className="mt-4 p-4 bg-indigo-50 rounded-lg border-2 border-dashed border-indigo-300">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-indigo-800">자동 수가 책정</h4>
        <span className="text-xs text-indigo-500">경쟁사 가격 기반</span>
      </div>

      {/* 경쟁사 가격 입력 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">경쟁사 가격 (원)</label>
          <input
            type="number"
            value={config.competitorPrice}
            onChange={(e) => handleChange('competitorPrice', e.target.value)}
            placeholder="150,000"
            min="0"
            className="w-full px-3 py-2 border border-indigo-300 rounded text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {(item.type === 'session' || item.type === 'mixed') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">경쟁사 회차</label>
            <input
              type="number"
              value={config.competitorSessions}
              onChange={(e) => handleChange('competitorSessions', e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-indigo-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}
        {(item.type === 'shot' || item.type === 'mixed') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">경쟁사 샷수</label>
            <input
              type="number"
              value={config.competitorShots}
              onChange={(e) => handleChange('competitorShots', e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-indigo-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">할인율 (%)</label>
          <input
            type="number"
            value={config.competitorDiscount}
            onChange={(e) => handleChange('competitorDiscount', e.target.value)}
            min="0"
            max="50"
            className="w-full px-3 py-2 border border-indigo-300 rounded text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-400 mt-0.5">경쟁사보다 몇% 저렴</p>
        </div>
      </div>

      {/* 고급 설정 토글 */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-indigo-600 hover:text-indigo-800 mb-3"
      >
        {showAdvanced ? '▾ 고급 설정 접기' : '▸ 고급 설정'}
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">체험가 마크업 (%)</label>
            <input
              type="number"
              value={config.trialMarkup}
              onChange={(e) => handleChange('trialMarkup', e.target.value)}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-0.5">이벤트가 대비 체험가 인상률</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              옵션 구간 ({item.type === 'shot' ? '샷수' : '회차'})
            </label>
            <input
              type="text"
              value={config.tiers}
              onChange={(e) => handleChange('tiers', e.target.value)}
              placeholder="3,5,10"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-0.5">쉼표로 구분</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">최소 단가 하락폭 (원)</label>
            <input
              type="number"
              value={config.minDiscountStep}
              onChange={(e) => handleChange('minDiscountStep', e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        onClick={handleGenerate}
        disabled={!Number(config.competitorPrice)}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded
                   hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors"
      >
        자동 가격 생성
      </button>
      <p className="text-xs text-gray-400 mt-1.5 text-center">
        생성된 가격은 수동으로 조정할 수 있습니다
      </p>
    </div>
  );
}
