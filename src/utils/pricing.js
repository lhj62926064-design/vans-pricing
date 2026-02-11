/**
 * pricing.js - VANS Clinic 가격 계산 로직
 *
 * 시술 유형:
 *   - session: 회차 기반 (1/3/5/10회)
 *   - shot:    샷수 기반 (100/300/600샷)
 *   - mixed:   혼합형 (N샷 × M회)
 *
 * 핵심 공식:
 *   회당가 = 가격 ÷ 회차
 *   샷당가 = 가격 ÷ 총샷수
 *   할인율(%) = (1 - 옵션단가 ÷ 기준단가) × 100
 */

/**
 * 금액을 지정 단위로 반올림
 * @param {number} value - 원래 금액
 * @param {number} unit  - 반올림 단위 (100, 1000, 10000)
 * @returns {number} 반올림된 금액
 */
export function roundPrice(value, unit = 1000) {
  if (!unit || unit <= 0) return Math.round(value);
  return Math.round(value / unit) * unit;
}

/**
 * 할인율 계산 (소수점 1자리)
 * @param {number} baseUnitPrice   - 기준 단가 (체험가 또는 이벤트가의 단가)
 * @param {number} optionUnitPrice - 옵션 단가
 * @returns {number|null} 할인율 (%), 기준 단가가 0이면 null
 */
export function calcDiscountRate(baseUnitPrice, optionUnitPrice) {
  if (!baseUnitPrice || baseUnitPrice <= 0) return null;
  const rate = (1 - optionUnitPrice / baseUnitPrice) * 100;
  return Math.round(rate * 10) / 10;
}

/**
 * 경쟁사 대비 가격 우위(%) 계산
 * (경쟁사단가 - 우리단가) ÷ 경쟁사단가 × 100
 * @param {number} competitorUnitPrice - 경쟁사 단가
 * @param {number} ourUnitPrice        - 우리 단가
 * @returns {number|null} 가격 우위 (%)
 */
export function calcCompetitorAdvantage(competitorUnitPrice, ourUnitPrice) {
  if (!competitorUnitPrice || competitorUnitPrice <= 0) return null;
  const rate =
    ((competitorUnitPrice - ourUnitPrice) / competitorUnitPrice) * 100;
  return Math.round(rate * 10) / 10;
}

/**
 * 단가 계산 (유형에 따라 회당가 또는 샷당가)
 * @param {string} type      - 시술 유형 (session | shot | mixed)
 * @param {number} price     - 가격
 * @param {number} sessions  - 회차 (session/mixed)
 * @param {number} shots     - 샷수 (shot/mixed)
 * @param {number} roundUnit - 반올림 단위
 * @returns {number} 단가
 */
export function calcUnitPrice(type, price, sessions, shots, roundUnit = 1000) {
  if (!price || price <= 0) return 0;

  let unitPrice = 0;
  switch (type) {
    case 'session':
      if (sessions && sessions > 0) unitPrice = price / sessions;
      break;
    case 'shot':
      if (shots && shots > 0) unitPrice = price / shots;
      break;
    case 'mixed': {
      const totalShots = (shots || 0) * (sessions || 0);
      if (totalShots > 0) unitPrice = price / totalShots;
      break;
    }
    default:
      break;
  }

  return roundPrice(unitPrice, roundUnit);
}

/**
 * 총량(총 회차 또는 총 샷수) 계산
 * @param {string} type     - 시술 유형
 * @param {number} sessions - 회차
 * @param {number} shots    - 샷수
 * @returns {number} 총량
 */
export function calcTotalQuantity(type, sessions, shots) {
  switch (type) {
    case 'session':
      return sessions || 0;
    case 'shot':
      return shots || 0;
    case 'mixed':
      return (shots || 0) * (sessions || 0);
    default:
      return 0;
  }
}

/**
 * 하나의 시술(item) 전체 결과 행 계산
 * @param {object} item      - 시술 데이터
 * @param {number} roundUnit - 반올림 단위
 * @returns {Array<object>} 결과 행 배열
 */
export function computeItemRows(item, roundUnit = 1000) {
  const {
    type,
    trialPrice,
    eventPrice,
    baseShots,
    options,
    competitor,
  } = item;

  const rows = [];

  // ── 1) 체험가 행 ──
  const trialSessions = 1;
  const trialShots =
    type === 'shot' || type === 'mixed' ? (baseShots || 100) : 0;
  const trialUnitPrice = calcUnitPrice(
    type,
    trialPrice,
    trialSessions,
    trialShots,
    roundUnit,
  );

  rows.push({
    rowType: 'trial',
    label: '1회체험가',
    price: trialPrice || 0,
    sessions: trialSessions,
    shots: trialShots,
    totalQuantity: calcTotalQuantity(type, trialSessions, trialShots),
    unitPrice: trialUnitPrice,
    discountFromTrial: null,
    discountFromEvent: null,
    violation: false,
  });

  // ── 2) 이벤트가 행 ──
  const eventSessions = 1;
  const eventShots =
    type === 'shot' || type === 'mixed' ? (baseShots || 100) : 0;
  const eventUnitPrice = calcUnitPrice(
    type,
    eventPrice,
    eventSessions,
    eventShots,
    roundUnit,
  );

  const eventLabel =
    type === 'shot'
      ? `이벤트가 (${eventShots}샷)`
      : type === 'mixed'
        ? `이벤트가 (${eventShots}샷×1회)`
        : '이벤트가 (1회)';

  rows.push({
    rowType: 'event',
    label: eventLabel,
    price: eventPrice || 0,
    sessions: eventSessions,
    shots: eventShots,
    totalQuantity: calcTotalQuantity(type, eventSessions, eventShots),
    unitPrice: eventUnitPrice,
    discountFromTrial: calcDiscountRate(trialUnitPrice, eventUnitPrice),
    discountFromEvent: null,
    violation: false,
  });

  // ── 3) 옵션 행들 ──
  if (options && options.length > 0) {
    options.forEach((opt) => {
      const optSessions = opt.sessions || 1;
      const optShots = opt.shots || baseShots || 0;
      const optUnitPrice = calcUnitPrice(
        type,
        opt.price,
        optSessions,
        optShots,
        roundUnit,
      );
      const optTotalQty = calcTotalQuantity(type, optSessions, optShots);

      let label = '';
      switch (type) {
        case 'session':
          label = `${optSessions}회`;
          break;
        case 'shot':
          label = `${optShots}샷`;
          break;
        case 'mixed':
          label = `${optShots}샷 × ${optSessions}회 (총 ${optShots * optSessions}샷)`;
          break;
        default:
          label = '옵션';
      }

      rows.push({
        rowType: 'option',
        label,
        price: opt.price || 0,
        sessions: optSessions,
        shots: optShots,
        totalQuantity: optTotalQty,
        unitPrice: optUnitPrice,
        discountFromTrial: calcDiscountRate(trialUnitPrice, optUnitPrice),
        discountFromEvent: calcDiscountRate(eventUnitPrice, optUnitPrice),
        violation: false,
      });
    });
  }

  // ── 4) 경쟁사 행 ──
  if (competitor && competitor.enabled) {
    const compSessions = competitor.sessions || 1;
    const compShots = competitor.shots || baseShots || 0;
    const compUnitPrice = calcUnitPrice(
      type,
      competitor.price,
      compSessions,
      compShots,
      roundUnit,
    );
    const advantage = calcCompetitorAdvantage(compUnitPrice, eventUnitPrice);

    let label = competitor.name || '경쟁사';
    switch (type) {
      case 'session':
        label += ` (${compSessions}회)`;
        break;
      case 'shot':
        label += ` (${compShots}샷)`;
        break;
      case 'mixed':
        label += ` (${compShots}샷×${compSessions}회)`;
        break;
    }

    rows.push({
      rowType: 'competitor',
      label,
      price: competitor.price || 0,
      sessions: compSessions,
      shots: compShots,
      totalQuantity: calcTotalQuantity(type, compSessions, compShots),
      unitPrice: compUnitPrice,
      discountFromTrial: null,
      discountFromEvent: null,
      competitorAdvantage: advantage,
      violation: false,
    });
  }

  return rows;
}

/**
 * 단가 라벨 반환 (유형별)
 * @param {string} type - 시술 유형
 * @returns {string} "회당가" 또는 "샷당가"
 */
export function getUnitLabel(type) {
  switch (type) {
    case 'session':
      return '회당가';
    case 'shot':
    case 'mixed':
      return '샷당가';
    default:
      return '단가';
  }
}

/**
 * 숫자를 천 단위 콤마 형식으로 포맷
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return num.toLocaleString('ko-KR');
}

/**
 * 금액 포맷 (원 단위)
 * @param {number} num
 * @returns {string}
 */
export function formatPrice(num) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return `${num.toLocaleString('ko-KR')}원`;
}
