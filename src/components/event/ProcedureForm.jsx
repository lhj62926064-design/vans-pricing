/**
 * ProcedureForm.jsx - 시술 추가/편집 폼
 */

import { useState } from 'react';

export default function ProcedureForm({ procedure, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: procedure?.name || '',
    trialPrice: procedure?.trialPrice || '',
    eventPrice: procedure?.eventPrice || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...procedure,
      name: form.name.trim(),
      trialPrice: Number(form.trialPrice) || 0,
      eventPrice: Number(form.eventPrice) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">시술명</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="예: 슈링크 300샷"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">체험가 (원)</label>
          <input
            type="number"
            value={form.trialPrice}
            onChange={(e) => setForm({ ...form, trialPrice: e.target.value })}
            placeholder="59,000"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이벤트가 (원)</label>
          <input
            type="number"
            value={form.eventPrice}
            onChange={(e) => setForm({ ...form, eventPrice: e.target.value })}
            placeholder="62,000"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!form.name.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded
                     hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {procedure?.id ? '수정' : '추가'}
        </button>
      </div>
    </form>
  );
}
