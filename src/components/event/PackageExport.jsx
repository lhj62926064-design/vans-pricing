/**
 * PackageExport.jsx - 패키지 카톡/엑셀 내보내기
 */

import { copyToClipboard } from '../../utils/export';
import { formatNumber } from '../../utils/pricing';

/**
 * 카카오톡 형식 텍스트 생성
 * 형식: ●시술명 가격
 */
function generatePackageKakaoText(packages) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;

  const lines = [];
  lines.push('한정 이벤트');
  lines.push(`${dateStr}`);
  lines.push('');

  for (const pkg of packages) {
    const price = Number(pkg.packagePrice) || 0;
    lines.push(`●${pkg.name} ${formatNumber(price)}원`);
  }

  return lines.join('\n');
}

/**
 * 엑셀(TSV) 형식 텍스트 생성
 */
function generatePackageExcelText(packages) {
  const rows = [];
  rows.push(['패키지명', '구성 시술', '정가 합계', '패키지가', '절약 금액', '할인율'].join('\t'));

  for (const pkg of packages) {
    const summary = pkg.summary || {};
    const itemNames = pkg.items?.map((i) => i.procedureName).join(' + ') || '';
    rows.push([
      pkg.name,
      itemNames,
      summary.totalRegularPrice || 0,
      pkg.packagePrice || 0,
      summary.savingsAmount || 0,
      summary.savingsPercent ? `${summary.savingsPercent}%` : '-',
    ].join('\t'));
  }

  return rows.join('\n');
}

export default function PackageExport({ packages, onToast }) {
  const handleKakao = async () => {
    const text = generatePackageKakaoText(packages);
    const ok = await copyToClipboard(text);
    onToast?.(ok ? '카카오톡 형식으로 복사되었습니다' : '복사에 실패했습니다');
  };

  const handleExcel = async () => {
    const text = generatePackageExcelText(packages);
    const ok = await copyToClipboard(text);
    onToast?.(ok ? '엑셀 형식으로 복사되었습니다' : '복사에 실패했습니다');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleKakao}
        className="px-4 py-2 bg-yellow-400 text-gray-800 text-sm font-bold rounded
                   hover:bg-yellow-500 transition-colors"
      >
        카톡 복사
      </button>
      <button
        onClick={handleExcel}
        className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded
                   hover:bg-green-700 transition-colors"
      >
        엑셀 복사
      </button>
    </div>
  );
}
