/**
 * csvParser.js - CSV 파싱 유틸리티
 *
 * 한국어 CSV 파일 파싱 (인코딩 자동감지, 컬럼 자동매핑)
 * 지원: UTF-8 (BOM 포함/미포함), EUC-KR
 */

/**
 * CSV 텍스트를 파싱하여 헤더 + 행 배열 반환
 * @param {string} text - CSV 텍스트
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseCSVText(text) {
  if (!text || !text.trim()) return { headers: [], rows: [] };

  // BOM 제거
  const cleaned = text.replace(/^\uFEFF/, '');

  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"') {
      if (inQuotes && cleaned[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = '';
      if (ch === '\r' && cleaned[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  // 구분자 감지 (comma vs tab)
  const delimiter = detectDelimiter(lines[0]);

  const headers = parseLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseLine(line, delimiter));

  return { headers, rows };
}

/**
 * 구분자 감지
 */
function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

/**
 * CSV 한 줄 파싱 (quoted fields 지원)
 */
function parseLine(line, delimiter) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());

  return fields;
}

/**
 * 헤더 이름을 표준 필드에 매핑
 * @param {string[]} headers
 * @returns {{ no: number, category: number, name: number, standardPrice: number, taxable: number, registeredDate: number }}
 */
export function detectColumns(headers) {
  const map = { no: -1, category: -1, name: -1, standardPrice: -1, taxable: -1, registeredDate: -1 };

  headers.forEach((h, i) => {
    const norm = h.replace(/["\s]/g, '').toLowerCase();
    if (norm === 'no.' || norm === 'no' || norm === '번호') map.no = i;
    else if (norm === '대분류' || norm === '카테고리' || norm === '분류') map.category = i;
    else if (norm === '진료항목명' || norm === '항목명' || norm === '시술명' || norm === '상품명') map.name = i;
    else if (norm === '표준가격' || norm === '가격' || norm === '단가' || norm === '금액') map.standardPrice = i;
    else if (norm === '과세여부' || norm === '과세') map.taxable = i;
    else if (norm === '등록일' || norm === '날짜' || norm === '등록일시') map.registeredDate = i;
  });

  return map;
}

/**
 * CSV 행을 표준 객체 배열로 변환
 * @param {string[][]} rows
 * @param {object} columnMap - detectColumns() 결과
 * @returns {Array<{ no: number, category: string, name: string, standardPrice: number, taxable: string }>}
 */
export function normalizeRows(rows, columnMap) {
  return rows
    .map((row) => {
      const name = columnMap.name >= 0 ? (row[columnMap.name] || '').trim() : '';
      if (!name) return null;

      const priceRaw = columnMap.standardPrice >= 0 ? (row[columnMap.standardPrice] || '') : '0';
      const standardPrice = Number(priceRaw.replace(/[,원\s]/g, '')) || 0;

      return {
        no: columnMap.no >= 0 ? Number(row[columnMap.no]) || 0 : 0,
        category: columnMap.category >= 0 ? (row[columnMap.category] || '').trim() : '',
        name,
        standardPrice,
        taxable: columnMap.taxable >= 0 ? (row[columnMap.taxable] || '').trim() : '',
      };
    })
    .filter(Boolean);
}

/**
 * File 객체에서 CSV 파싱 (인코딩 자동감지)
 * @param {File} file
 * @returns {Promise<{ headers: string[], data: Array, columnMap: object, rawRowCount: number }>}
 */
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      let text = e.target.result;

      // 깨진 한국어 감지 (EUC-KR → UTF-8 재시도)
      if (hasGarbledKorean(text)) {
        const reader2 = new FileReader();
        reader2.onload = (e2) => {
          try {
            resolve(processCSVText(e2.target.result));
          } catch (err) {
            reject(err);
          }
        };
        reader2.onerror = reject;
        reader2.readAsText(file, 'EUC-KR');
        return;
      }

      try {
        resolve(processCSVText(text));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * CSV 텍스트를 최종 데이터로 변환
 */
function processCSVText(text) {
  const { headers, rows } = parseCSVText(text);

  if (headers.length === 0) {
    throw new Error('CSV 파일에 헤더가 없습니다');
  }

  const columnMap = detectColumns(headers);

  if (columnMap.name < 0) {
    throw new Error('항목명 컬럼을 찾을 수 없습니다 (진료항목명, 항목명, 시술명 등)');
  }
  if (columnMap.standardPrice < 0) {
    throw new Error('가격 컬럼을 찾을 수 없습니다 (표준가격, 가격, 단가 등)');
  }

  const data = normalizeRows(rows, columnMap);

  return {
    headers,
    data,
    columnMap,
    rawRowCount: rows.length,
  };
}

/**
 * 깨진 한국어 패턴 감지
 * UTF-8로 읽었는데 EUC-KR인 경우 replacement character(�)가 많이 나타남
 */
function hasGarbledKorean(text) {
  const sample = text.slice(0, 500);
  const replacementCount = (sample.match(/\uFFFD/g) || []).length;
  return replacementCount > 3;
}
