/**
 * packagePricing.js - 패키지 이벤트 계산 로직
 */

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
