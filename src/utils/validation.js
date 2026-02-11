/**
 * validation.js - Monotonic Discount Rule 검증
 *
 * 핵심 규칙:
 *   - 회차↑ → 회당가 반드시 ↓
 *   - 샷수↑ → 샷당가 반드시 ↓
 *   - 혼합형: 총샷수(샷×회) 기준, 총량↑ → 샷당가↓
 *
 * 위반 시 해당 행에 violation 플래그를 설정하고,
 * violations 배열에 위반 메시지를 추가합니다.
 */

/**
 * Monotonic Discount Rule 검증
 * rows 배열을 받아서, 총량이 증가했는데 단가가 내리지 않은 행을 찾아
 * violation = true 로 표시하고, violations 메시지 배열을 반환합니다.
 *
 * @param {Array<object>} rows     - computeItemRows()의 결과
 * @param {string}        itemName - 시술명 (경고 메시지용)
 * @returns {{ rows: Array<object>, violations: Array<string> }}
 */
export function validateMonotonic(rows, itemName = '') {
  const violations = [];
  // 위반 행의 label을 Set으로 추적 (불변성 유지를 위해 원본 객체를 변경하지 않음)
  const violationLabels = new Set();

  // 경쟁사 행은 Monotonic 검증 대상이 아님
  // trial, event, option 행만 순서대로 검증
  const checkableRows = rows.filter(
    (r) => r.rowType === 'trial' || r.rowType === 'event' || r.rowType === 'option',
  );

  // 유효한 행만 필터 (가격과 단가가 모두 > 0)
  const validRows = checkableRows.filter(
    (r) => r.price > 0 && r.unitPrice > 0 && r.totalQuantity > 0,
  );

  // 총량 기준 오름차순 정렬 (같으면 원래 순서 유지)
  const sorted = [...validRows].sort(
    (a, b) => a.totalQuantity - b.totalQuantity,
  );

  // 인접한 두 행 비교: 총량↑ 인데 단가가 ↓가 아닌 경우 위반
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // 총량이 같으면 단가도 같아야 하거나, 다를 수 있음 (검증 대상 아님)
    if (curr.totalQuantity <= prev.totalQuantity) continue;

    // 총량이 증가했는데 단가가 같거나 더 비싸면 위반
    if (curr.unitPrice >= prev.unitPrice) {
      violationLabels.add(curr.label);
      const prefix = itemName ? `[${itemName}] ` : '';
      violations.push(
        `${prefix}"${curr.label}" 단가(${curr.unitPrice.toLocaleString('ko-KR')}원)가 ` +
        `"${prev.label}" 단가(${prev.unitPrice.toLocaleString('ko-KR')}원)보다 ` +
        `높거나 같습니다. 수량↑ → 단가↓ 규칙 위반!`,
      );
    }
  }

  // 불변적으로 새 배열 반환: violation 플래그를 새 객체로 설정
  const updatedRows = rows.map((row) => ({
    ...row,
    violation: violationLabels.has(row.label),
  }));

  return { rows: updatedRows, violations };
}

/**
 * 전체 시술 목록의 모든 violations를 모아서 반환
 * @param {Array<{ name: string, rows: Array<object> }>} allItems
 * @returns {Array<string>} 모든 위반 메시지
 */
export function validateAll(allItems) {
  const allViolations = [];

  for (const { name, rows } of allItems) {
    const { violations } = validateMonotonic(rows, name);
    allViolations.push(...violations);
  }

  return allViolations;
}
