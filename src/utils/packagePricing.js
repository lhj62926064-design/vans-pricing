/**
 * packagePricing.js - 패키지 이벤트 계산 로직
 */

import { roundPrice } from './pricing';

/**
 * 벌크 텍스트에서 패키지 목록 파싱
 *
 * 지원 형식:
 *   ●패키지명 가격원
 *   ●패키지명 가격
 *   - 패키지명 가격원
 *   패키지명 가격원
 *
 * 가격에 콤마 포함 가능: 690,000원
 *
 * @param {string} text - 벌크 입력 텍스트
 * @returns {Array<object>} 파싱된 패키지 배열
 */
export function parsePackageText(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const packages = [];

  for (const line of lines) {
    const cleaned = line.replace(/^[●•·\-\*]\s*/, '');
    if (!cleaned) continue;

    // 가격 추출: 마지막에 나오는 숫자(콤마 포함) + 선택적 "원"
    const priceMatch = cleaned.match(/\s+([\d,]+)\s*원?\s*$/);
    if (!priceMatch) {
      packages.push({
        id: Date.now() + packages.length,
        name: cleaned.trim(),
        packagePrice: 0,
        items: parsePackageItems(cleaned.trim()),
      });
      continue;
    }

    const name = cleaned.slice(0, priceMatch.index).trim();
    const price = Number(priceMatch[1].replace(/,/g, '')) || 0;

    if (!name) continue;

    packages.push({
      id: Date.now() + packages.length,
      name,
      packagePrice: price,
      items: parsePackageItems(name),
    });
  }

  return packages;
}

/**
 * 패키지명에서 구성 시술 파싱
 * "슈링크300+인모드fx 얼전" → [{procedureName: "슈링크300"}, {procedureName: "인모드fx 얼전"}]
 * "파워윤곽주사 3회" → [{procedureName: "파워윤곽주사", quantity: 3}]
 */
function parsePackageItems(packageName) {
  const parts = packageName.split('+').map((s) => s.trim()).filter(Boolean);

  return parts.map((part) => {
    const qtyMatch = part.match(/\s+(\d+)회\s*$/);
    const quantity = qtyMatch ? Number(qtyMatch[1]) : 1;
    const procName = qtyMatch ? part.slice(0, qtyMatch.index).trim() : part;

    return {
      procedureName: procName,
      quantity,
      individualPrice: 0,
      priceSource: 'manual',
    };
  });
}

/**
 * 시술 라이브러리에서 가격 매칭
 * @param {Array} packages - parsePackageText 결과
 * @param {Array} procedures - 시술 라이브러리
 * @returns {Array} 가격이 매칭된 패키지 배열
 */
export function matchProcedurePrices(packages, procedures) {
  if (!procedures || procedures.length === 0) return packages;

  return packages.map((pkg) => ({
    ...pkg,
    items: pkg.items.map((item) => {
      const match = procedures.find((p) =>
        p.name && item.procedureName &&
        (p.name.includes(item.procedureName) ||
         item.procedureName.includes(p.name) ||
         p.name.replace(/\s+/g, '') === item.procedureName.replace(/\s+/g, ''))
      );
      if (match) {
        return {
          ...item,
          procedureId: match.id,
          individualPrice: match.eventPrice || match.trialPrice || 0,
          priceSource: match.eventPrice ? 'event' : 'trial',
        };
      }
      return item;
    }),
  }));
}

/**
 * 목표 할인율로 패키지가 자동 계산
 * @param {object} pkg - 패키지 (items 포함)
 * @param {number} targetDiscountPercent - 목표 할인율 (예: 30 → 30%)
 * @param {number} roundUnit - 반올림 단위
 * @returns {number} 계산된 패키지가
 */
export function calcPackagePriceFromDiscount(pkg, targetDiscountPercent, roundUnit = 10000) {
  const totalRegular = pkg.items.reduce(
    (sum, item) => sum + (Number(item.individualPrice) || 0) * (Number(item.quantity) || 1),
    0,
  );
  if (totalRegular <= 0) return 0;
  const discounted = totalRegular * (1 - targetDiscountPercent / 100);
  return roundPrice(discounted, roundUnit);
}

/**
 * 패키지 요약 계산
 * @param {object} pkg - 패키지 객체
 * @returns {object} 요약 정보
 */
export function computePackageSummary(pkg) {
  if (!pkg || !pkg.items || pkg.items.length === 0) {
    return {
      totalRegularPrice: 0,
      packagePrice: pkg?.packagePrice || 0,
      savingsAmount: 0,
      savingsPercent: 0,
      perItemBreakdown: [],
    };
  }

  const totalRegular = pkg.items.reduce(
    (sum, item) => sum + (Number(item.individualPrice) || 0) * (Number(item.quantity) || 1),
    0,
  );

  const packagePrice = Number(pkg.packagePrice) || 0;
  const savingsAmount = totalRegular - packagePrice;
  const savingsPercent =
    totalRegular > 0 ? Math.round((savingsAmount / totalRegular) * 1000) / 10 : 0;

  const perItemBreakdown = pkg.items.map((item) => {
    const itemTotal = (Number(item.individualPrice) || 0) * (Number(item.quantity) || 1);
    const proportion = totalRegular > 0 ? itemTotal / totalRegular : 0;
    const allocatedPrice = Math.round(packagePrice * proportion);

    return {
      name: item.procedureName,
      quantity: Number(item.quantity) || 1,
      originalPrice: itemTotal,
      allocatedPrice,
      savingsPercent:
        itemTotal > 0
          ? Math.round((1 - allocatedPrice / itemTotal) * 1000) / 10
          : 0,
    };
  });

  return {
    totalRegularPrice: totalRegular,
    packagePrice,
    savingsAmount,
    savingsPercent,
    perItemBreakdown,
  };
}
