/**
 * ProcedureLibrary.jsx - 시술 라이브러리 관리
 */

import { useState } from 'react';
import ProcedureForm from './ProcedureForm';

export default function ProcedureLibrary({ procedures, onSave, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState(null);

  const handleEdit = (proc) => {
    setEditingProcedure(proc);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingProcedure(null);
    setShowForm(true);
  };

  const handleSave = (proc) => {
    onSave(proc);
    setShowForm(false);
    setEditingProcedure(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-700">시술 라이브러리</h3>
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded
                     hover:bg-blue-700 transition-colors"
        >
          + 시술 추가
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <ProcedureForm
            procedure={editingProcedure}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingProcedure(null); }}
          />
        </div>
      )}

      {procedures.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          등록된 시술이 없습니다.<br />
          시술을 추가하면 패키지에 사용할 수 있습니다.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {procedures.map((proc) => (
            <div
              key={proc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200
                         hover:border-gray-300 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-800 truncate">{proc.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  체험가 {Number(proc.trialPrice || 0).toLocaleString()}원
                  {' / '}
                  이벤트가 {Number(proc.eventPrice || 0).toLocaleString()}원
                </div>
              </div>
              <div className="flex gap-1.5 ml-2 shrink-0">
                <button
                  onClick={() => handleEdit(proc)}
                  className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={() => onDelete(proc.id)}
                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
