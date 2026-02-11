/**
 * PackageBuilder.jsx - 패키지 구성기
 */

import { useState, useEffect, useMemo } from 'react';
import { formatNumber } from '../../utils/pricing';
import { computePackageSummary } from '../../utils/packagePricing';

export default function PackageBuilder({ procedures, editingPackage, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);

  // 편집 모드일 때 데이터 로드
  useEffect(() => {
    if (editingPackage) {
      setName(editingPackage.name || '');
      setPackagePrice(editingPackage.packagePrice || '');
      setSelectedItems(editingPackage.items || []);
    } else {
      setName('');
      setPackagePrice('');
      setSelectedItems([]);
    }
  }, [editingPackage]);

  // 시술 추가
  const addProcedure = (proc) => {
    setSelectedItems((prev) => [
      ...prev,
      {
        procedureId: proc.id,
        procedureName: proc.name,
        quantity: 1,
        individualPrice: proc.eventPrice || proc.trialPrice || 0,
        priceSource: proc.eventPrice ? 'event' : 'trial',
      },
    ]);
  };

  // 시술 제거
  const removeItem = (idx) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // 수량 변경
  const updateQuantity = (idx, qty) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: Math.max(1, Number(qty) || 1) } : item)),
    );
  };

  // 개별 가격 변경
  const updatePrice = (idx, price) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, individualPrice: Number(price) || 0 } : item)),
    );
  };

  // 요약 계산
  const summary = useMemo(() => {
    return computePackageSummary({
      items: selectedItems,
      packagePrice: Number(packagePrice) || 0,
    });
  }, [selectedItems, packagePrice]);

  // 저장
  const handleSave = () => {
    if (!name.trim() || selectedItems.length === 0) return;
    onSave({
      ...(editingPackage || {}),
      name: name.trim(),
      packagePrice: Number(packagePrice) || 0,
      items: selectedItems,
    });
  };

  // 사용 가능한 시술 (라이브러리에서)
  const availableProcedures = procedures.filter(
    (p) => !selectedItems.some((s) => s.procedureId === p.id),
  );

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        {editingPackage ? '패키지 수정' : '패키지 구성'}
      </h3>

      {/* 패키지명 */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">패키지명</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 슈링크300+인모드fx 얼전"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* 시술 선택 */}
      {availableProcedures.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">시술 추가</label>
          <div className="flex flex-wrap gap-1.5">
            {availableProcedures.map((proc) => (
              <button
                key={proc.id}
                onClick={() => addProcedure(proc)}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded
                           hover:bg-blue-100 transition-colors border border-blue-200"
              >
                + {proc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 시술 목록 */}
      {selectedItems.length > 0 && (
        <div className="mb-3 space-y-2">
          {selectedItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2.5 bg-gray-50 rounded border border-gray-200"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{item.procedureName}</div>
              </div>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateQuantity(idx, e.target.value)}
                min="1"
                className="w-14 px-2 py-1 border border-gray-300 rounded text-xs text-center
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-xs text-gray-500">회</span>
              <input
                type="number"
                value={item.individualPrice}
                onChange={(e) => updatePrice(idx, e.target.value)}
                min="0"
                className="w-24 px-2 py-1 border border-gray-300 rounded text-xs text-right
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-xs text-gray-500">원</span>
              <button
                onClick={() => removeItem(idx)}
                className="text-red-400 hover:text-red-600 text-sm font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 패키지 가격 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">패키지 이벤트가 (원)</label>
        <input
          type="number"
          value={packagePrice}
          onChange={(e) => setPackagePrice(e.target.value)}
          placeholder="690,000"
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* 요약 */}
      {selectedItems.length > 0 && Number(packagePrice) > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">정가 합계</div>
              <div className="text-sm font-bold text-gray-800">
                {formatNumber(summary.totalRegularPrice)}원
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">패키지가</div>
              <div className="text-sm font-bold text-blue-700">
                {formatNumber(summary.packagePrice)}원
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">절약</div>
              <div className={`text-sm font-bold ${summary.savingsAmount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {summary.savingsAmount > 0 ? '-' : '+'}{formatNumber(Math.abs(summary.savingsAmount))}원
                <span className="text-xs ml-0.5">({summary.savingsPercent}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex gap-2 justify-end">
        {editingPackage && (
          <button
            onClick={onCancel}
            className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            취소
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!name.trim() || selectedItems.length === 0}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded
                     hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {editingPackage ? '패키지 수정' : '패키지 저장'}
        </button>
      </div>
    </div>
  );
}
