/**
 * PackageList.jsx - 저장된 패키지 목록
 */

import { formatNumber } from '../../utils/pricing';

export default function PackageList({ packages, onEdit, onDelete }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        저장된 패키지 ({packages.length}개)
      </h3>
      <div className="space-y-2">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-gray-800">{pkg.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {pkg.items?.map((item) => item.procedureName).join(' + ')}
                </div>
                <div className="flex gap-4 mt-1.5 text-xs">
                  <span className="text-gray-600">
                    정가 {formatNumber(pkg.summary?.totalRegularPrice || 0)}원
                  </span>
                  <span className="font-bold text-blue-700">
                    패키지가 {formatNumber(pkg.packagePrice)}원
                  </span>
                  {pkg.summary?.savingsPercent > 0 && (
                    <span className="text-green-600 font-bold">
                      {pkg.summary.savingsPercent}% 할인
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 ml-2 shrink-0">
                <button
                  onClick={() => onEdit(pkg)}
                  className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={() => onDelete(pkg.id)}
                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
