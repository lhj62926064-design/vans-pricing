/**
 * packagePricing.js - 패키지 이벤트 계산 로직
 *
 * 지원 형식:
 *   1) 기본: ●패키지명 가격원
 *   2) 확장: ■패키지명 가격원 / ㄴ시술명: 1체 X만원 / 이벤트 Y만원
 */

import { roundPrice } from './pricing';

// ─── 한국어 가격 파싱 헬퍼 ───

/**
 * 한국어 가격 문자열 파싱
 * "5.5만원" → 55000, "5.5만" → 55000, "99,000원" → 99000, "9900" → 9900
 */
function parseKoreanPrice(str) {
  if (!str) return 0;
  str = str.toString().trim();

  // "5.5만원" or "5.5만" or "85만원"
  const manMatch = str.match(/([\d.]+)\s*만/);
  if (manMatch) {
    return Math.round(parseFloat(manMatch[1]) * 10000);
  }

  // "99,000원" or "99000" or "9,900원"
  const wonMatch = str.match(/([\d,]+)/);
  if (wonMatch) {
    return Number(wonMatch[1].replace(/,/g, '')) || 0;
  }

  return 0;
}

/**
 * 가격 문자열에서 1체/이벤트 가격 추출
 * "1체 5.5만원 / 이벤트 12.9만원" → { trial: 55000, event: 129000 }
 * "이벤트 2.3만원" → { trial: 0, event: 23000 }
 * "5.3만원" → { trial: 0, event: 53000 }
 */
function extractPrices(str) {
  let trial = 0;
  let event = 0;

  // "1체 5.5만원" or "1체 9,900원"
  const trialMatch = str.match(/1체\s+([\d.,]+\s*만?\s*원?)/);
  if (trialMatch) {
    trial = parseKoreanPrice(trialMatch[1]);
  }

  // "이벤트 12.9만원" or "1회 이벤트 59만원"
  const eventMatch = str.match(/이벤트\s+([\d.,]+\s*만?\s*원?)/);
  if (eventMatch) {
    event = parseKoreanPrice(eventMatch[1]);
  }

  // 라벨 없는 단일 가격: "5.3만원"
  if (!trial && !event) {
    const rawPrice = parseKoreanPrice(str);
    if (rawPrice > 0) {
      event = rawPrice;
    }
  }

  return { trial, event };
}

// ─── 확장 포맷 파서 (■/ㄴ) ───

/**
 * ㄴ 하위항목 라인 파싱
 * "ㄴ물광2cc: 1체 5.5만원 / 이벤트 12.9만원" → [{ name, trialPrice, eventPrice }]
 * "ㄴ스킨B 원더 1부위: 이벤트 2.3만원 / 얼전: 이벤트 5.3만원" → 2개 항목
 * "ㄴ코 프락셀X" → [{ isNote: true }]
 */
function parseSubItemLine(line) {
  const content = line.replace(/^ㄴ\s*/, '').trim();
  if (!content) return [];

  // 참고용 메모: 콜론 없고 가격 정보 없음 (예: "코 프락셀X")
  if (!content.includes(':')) {
    return [{ name: content, trialPrice: 0, eventPrice: 0, isNote: true }];
  }

  // "/" 로 분리 후 각 세그먼트 처리
  const segments = content.split('/').map((s) => s.trim());
  const results = [];
  let pendingName = '';
  let pendingTrial = 0;
  let pendingEvent = 0;

  for (const seg of segments) {
    const colonIdx = seg.indexOf(':');

    if (colonIdx > 0 && !/^\d/.test(seg)) {
      // 새 항목: "이름: 가격정보"
      if (pendingName) {
        results.push({
          name: pendingName,
          trialPrice: pendingTrial,
          eventPrice: pendingEvent,
          isNote: false,
        });
      }
      pendingName = seg.slice(0, colonIdx).trim();
      const priceStr = seg.slice(colonIdx + 1).trim();
      const prices = extractPrices(priceStr);
      pendingTrial = prices.trial;
      pendingEvent = prices.event;
    } else {
      // 현재 항목의 가격 계속
      const prices = extractPrices(seg);
      if (prices.trial) pendingTrial = prices.trial;
      if (prices.event) pendingEvent = prices.event;
    }
  }

  if (pendingName) {
    results.push({
      name: pendingName,
      trialPrice: pendingTrial,
      eventPrice: pendingEvent,
      isNote: false,
    });
  }

  return results;
}

/**
 * ■ 메인 패키지 라인 파싱 (유연한 가격 추출)
 * 만원/원 형식 모두 지원, 괄호 메모 추출, 가격이 중간에 있는 경우 처리
 */
function parseEnhancedMainLine(text) {
  // 괄호 메모 추출
  const memos = [];
  let stripped = text.replace(/\(([^)]*)\)/g, (_, c) => {
    memos.push(c.trim());
    return ' ';
  });
  stripped = stripped.replace(/\s+/g, ' ').trim();

  let name = stripped;
  let price = 0;
  let m;

  // 1) 끝에 만원: "85만원"
  m = stripped.match(/\s+([\d.]+)\s*만\s*원?\s*$/);
  if (m) {
    price = Math.round(parseFloat(m[1]) * 10000);
    name = stripped.slice(0, m.index).trim();
  }

  // 2) 끝에 원: "99000원"
  if (!price) {
    m = stripped.match(/\s+([\d,]+)\s*원?\s*$/);
    if (m) {
      const val = Number(m[1].replace(/,/g, ''));
      if (val >= 1000) {
        price = val;
        name = stripped.slice(0, m.index).trim();
      }
    }
  }

  // 3) 중간에 원 (뒤에 설명 있음): "180000원 1년 무제한"
  if (!price) {
    m = stripped.match(/\s+([\d,]{4,})\s*원\s/);
    if (m) {
      price = Number(m[1].replace(/,/g, ''));
      name = stripped.slice(0, m.index).trim();
      const trailing = stripped.slice(m.index + m[0].length).trim();
      if (trailing) memos.push(trailing);
    }
  }

  // 4) 중간에 만원 (뒤에 설명 있음)
  if (!price) {
    m = stripped.match(/\s+([\d.]+)\s*만\s*원?\s/);
    if (m) {
      price = Math.round(parseFloat(m[1]) * 10000);
      name = stripped.slice(0, m.index).trim();
      const trailing = stripped.slice(m.index + m[0].length).trim();
      if (trailing) memos.push(trailing);
    }
  }

  return {
    id: Date.now() + Math.random(),
    name,
    packagePrice: price,
    memo: memos.filter(Boolean).join('; ') || '',
    subItems: [],
    description: [],
  };
}

/**
 * 확장 패키지 마무리: subItems → items 변환
 * ㄴ 하위항목이 있으면 그 가격 사용, 없으면 + 분리 방식 사용
 */
function finalizeEnhancedPackage(raw) {
  const { subItems, description, memo, ...rest } = raw;

  let items;
  if (subItems && subItems.length > 0) {
    // 가격 있는 하위항목만 items로 변환
    const pricedSubs = subItems.filter(
      (s) => !s.isNote && (s.trialPrice > 0 || s.eventPrice > 0),
    );
    if (pricedSubs.length > 0) {
      items = pricedSubs.map((s) => ({
        procedureName: s.name,
        quantity: 1,
        individualPrice: s.trialPrice || s.eventPrice || 0,
        priceSource: s.trialPrice ? 'trial' : 'event',
      }));
    }
  }

  // 하위항목 없으면 기존 + 분리 방식
  if (!items || items.length === 0) {
    items = parsePackageItems(raw.name);
  }

  // 설명 + 메모 합치기
  let finalMemo = memo || '';
  if (description && description.length > 0) {
    const descText = description.join(' / ');
    finalMemo = finalMemo ? `${finalMemo}; ${descText}` : descText;
  }

  return {
    ...rest,
    items,
    memo: finalMemo || undefined,
  };
}

/**
 * 확장 포맷 파서 (■/ㄴ 구조 입력)
 */
function parseEnhancedFormat(lines) {
  const packages = [];
  let current = null;

  for (const line of lines) {
    // ㄴ 하위항목
    if (line.startsWith('ㄴ')) {
      if (current) {
        const subs = parseSubItemLine(line);
        current.subItems.push(...subs);
      }
      continue;
    }

    // ■ 메인 패키지
    if (line.startsWith('■')) {
      if (current) {
        packages.push(finalizeEnhancedPackage(current));
      }
      const cleaned = line.replace(/^■\s*/, '').trim();
      if (cleaned) {
        current = parseEnhancedMainLine(cleaned);
      }
      continue;
    }

    // 기타: 현재 패키지의 설명으로 추가
    if (current) {
      current.description.push(line);
    }
  }

  if (current) {
    packages.push(finalizeEnhancedPackage(current));
  }

  return packages;
}

// ─── 기본 포맷 파서 (●/- 방식) ───

function parseSimpleFormat(lines) {
  const packages = [];

  for (const line of lines) {
    const cleaned = line.replace(/^[●•·\-*■]\s*/, '');
    if (!cleaned) continue;

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

// ─── 공통 함수 ───

/**
 * 벌크 텍스트에서 패키지 목록 파싱
 * ■/ㄴ 형식 감지 시 확장 파서, 아니면 기본 파서 사용
 */
export function parsePackageText(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // ■ 또는 ㄴ 이 있으면 확장 포맷
  const hasEnhanced = lines.some((l) => l.startsWith('■') || l.startsWith('ㄴ'));
  if (hasEnhanced) {
    return parseEnhancedFormat(lines);
  }

  return parseSimpleFormat(lines);
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
 */
export function matchProcedurePrices(packages, procedures) {
  if (!procedures || procedures.length === 0) return packages;

  return packages.map((pkg) => ({
    ...pkg,
    items: pkg.items.map((item) => {
      // 이미 ㄴ 파싱에서 가격이 설정된 경우 스킵
      if (item.individualPrice > 0 && (item.priceSource === 'trial' || item.priceSource === 'event')) {
        return item;
      }

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
 * 지점 수가 라이브러리에서 가격 매칭
 */
export function matchBranchPrices(packages, branchProcedures) {
  if (!branchProcedures || branchProcedures.length === 0) return packages;

  return packages.map((pkg) => ({
    ...pkg,
    items: pkg.items.map((item) => {
      // 이미 가격 매칭된 경우 스킵 (ㄴ 파싱, 라이브러리)
      if (item.individualPrice > 0 && item.priceSource !== 'branch') return item;

      const match = findBestBranchMatch(item.procedureName, branchProcedures);
      if (match) {
        return {
          ...item,
          individualPrice: match.standardPrice,
          priceSource: 'branch',
          branchCategory: match.category,
        };
      }
      return item;
    }),
  }));
}

/**
 * 지점 수가에서 최적 매칭 찾기
 * 우선순위: 정확 일치 > 정규화 일치 > 포함 > 토큰 매칭
 */
function findBestBranchMatch(name, procedures) {
  if (!name) return null;
  const normalized = name.replace(/\s+/g, '').toLowerCase();

  // 1. 정확 일치
  let match = procedures.find((p) => p.name === name);
  if (match) return match;

  // 2. 공백 정규화 일치
  match = procedures.find((p) => p.name.replace(/\s+/g, '').toLowerCase() === normalized);
  if (match) return match;

  // 3. 포함 (양방향)
  match = procedures.find((p) =>
    p.name.replace(/\s+/g, '').toLowerCase().includes(normalized) ||
    normalized.includes(p.name.replace(/\s+/g, '').toLowerCase())
  );
  if (match) return match;

  // 4. 토큰 매칭 (모든 단어가 포함)
  const tokens = name.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length > 1) {
    match = procedures.find((p) => {
      const pNorm = p.name.replace(/\s+/g, '').toLowerCase();
      return tokens.every((t) => pNorm.includes(t.toLowerCase()));
    });
  }

  return match || null;
}

/**
 * 목표 할인율로 패키지가 자동 계산
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
