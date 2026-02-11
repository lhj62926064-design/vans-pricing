/**
 * export.js - 카카오톡 / 엑셀용 텍스트 생성
 *
 * 카톡용: 이모지 포함 보기 좋은 텍스트
 * 엑셀용: TSV(탭 구분) 형식
 */

import { formatPrice, getUnitLabel } from './pricing.js';

/**
 * 오늘 날짜를 "YYYY. M. D." 형식으로 반환
 * @returns {string}
 */
function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;
}

/**
 * 할인율 포맷 문자열 생성
 * @param {number|null} rate - 할인율
 * @returns {string}
 */
function fmtDiscount(rate) {
  if (rate === null || rate === undefined) return '';
  return `${Math.abs(rate)}%${rate >= 0 ? '↓' : '↑'}`;
}

/**
 * 카카오톡용 텍스트 생성
 * @param {Array<object>} items    - 시술 목록 (각 item에 name, type, rows 포함)
 * @param {number}        roundUnit - 반올림 단위
 * @returns {string} 카톡 복사용 텍스트
 */
export function generateKakaoText(items, roundUnit) {
  const lines = [];
  lines.push('📋 이벤트 가격표');
  lines.push(`📅 ${getDateString()}`);

  for (const item of items) {
    if (!item.rows || item.rows.length === 0) continue;

    lines.push('');
    lines.push(`▸ ${item.name || '시술명 미입력'}`);

    const unitLabel = getUnitLabel(item.type);

    for (const row of item.rows) {
      if (row.rowType === 'competitor') {
        // 경쟁사 행
        const advStr =
          row.competitorAdvantage !== null && row.competitorAdvantage !== undefined
            ? ` [우리가 ${Math.abs(row.competitorAdvantage)}%${row.competitorAdvantage >= 0 ? ' 저렴' : ' 비쌈'}]`
            : '';
        lines.push(
          `  🏢 ${row.label}: ${formatPrice(row.price)} (${unitLabel} ${formatPrice(row.unitPrice)})${advStr}`,
        );
        continue;
      }

      const unitStr = `(${unitLabel} ${formatPrice(row.unitPrice)})`;

      if (row.rowType === 'trial') {
        lines.push(`  1회체험가: ${formatPrice(row.price)}`);
      } else if (row.rowType === 'event') {
        lines.push(`  이벤트가: ${formatPrice(row.price)} ${unitStr}`);
      } else {
        // 옵션 행
        const discountStr = row.discountFromEvent
          ? ` [${fmtDiscount(row.discountFromEvent)}]`
          : '';
        const warningStr = row.violation ? ' ⚠️' : '';
        lines.push(
          `  ${row.label}: ${formatPrice(row.price)} ${unitStr}${discountStr}${warningStr}`,
        );
      }
    }
  }

  lines.push('');
  lines.push(`반올림: ${roundUnit.toLocaleString('ko-KR')}원 단위`);

  return lines.join('\n');
}

/**
 * 엑셀(TSV)용 텍스트 생성
 * @param {Array<object>} items    - 시술 목록
 * @param {number}        roundUnit - 반올림 단위
 * @returns {string} TSV 형식 텍스트
 */
export function generateExcelText(items, roundUnit) {
  const rows = [];

  for (const item of items) {
    if (!item.rows || item.rows.length === 0) continue;

    const unitLabel = getUnitLabel(item.type);

    // 헤더 행
    rows.push(
      [
        '시술명',
        '옵션',
        '가격',
        unitLabel,
        '체험가대비',
        '이벤트가대비',
        '규칙',
        ...(item.rows.some((r) => r.rowType === 'competitor')
          ? ['경쟁사 가격우위']
          : []),
      ].join('\t'),
    );

    for (const row of item.rows) {
      const cols = [
        item.name || '',
        row.label || '',
        row.price || 0,
        row.unitPrice || 0,
        row.discountFromTrial !== null && row.discountFromTrial !== undefined
          ? `${row.discountFromTrial}%`
          : '-',
        row.discountFromEvent !== null && row.discountFromEvent !== undefined
          ? `${row.discountFromEvent}%`
          : '-',
        row.violation ? '⚠ 위반' : '✓ OK',
      ];

      // 경쟁사 가격우위 컬럼
      if (item.rows.some((r) => r.rowType === 'competitor')) {
        cols.push(
          row.competitorAdvantage !== null && row.competitorAdvantage !== undefined
            ? `${row.competitorAdvantage}%`
            : '-',
        );
      }

      rows.push(cols.join('\t'));
    }

    rows.push(''); // 시술 간 빈 줄
  }

  return rows.join('\n');
}

/**
 * 클립보드에 텍스트 복사
 * @param {string} text - 복사할 텍스트
 * @returns {Promise<boolean>} 성공 여부
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // fallback: textarea 방식
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (fallbackErr) {
      console.error('클립보드 복사 실패:', fallbackErr);
      return false;
    }
  }
}
