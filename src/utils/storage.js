/**
 * storage.js - localStorage + JSON 파일 관리
 *
 * 기능:
 *   - 자동 저장/복원 (localStorage)
 *   - 프리셋 저장/불러오기/삭제
 *   - JSON 파일 내보내기/가져오기
 */

const STORAGE_KEY = 'vans-pricing-data';
const PRESETS_KEY = 'vans-pricing-presets';
const ROUND_UNIT_KEY = 'vans-pricing-round-unit';

// ── 자동 저장/복원 ──

/**
 * 현재 데이터를 localStorage에 자동 저장
 * @param {object} data - 저장할 전체 상태 (items 배열, activeTab 등)
 */
export function autoSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('자동 저장 실패:', err);
  }
}

/**
 * localStorage에서 자동 저장된 데이터 복원
 * @returns {object|null} 저장된 데이터 또는 null
 */
export function autoLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('자동 복원 실패:', err);
    return null;
  }
}

// ── 반올림 단위 저장 ──

/**
 * 반올림 단위 저장
 * @param {number} unit
 */
export function saveRoundUnit(unit) {
  try {
    localStorage.setItem(ROUND_UNIT_KEY, String(unit));
  } catch (err) {
    console.error('반올림 단위 저장 실패:', err);
  }
}

/**
 * 반올림 단위 불러오기
 * @returns {number} 기본값 1000
 */
export function loadRoundUnit() {
  try {
    const raw = localStorage.getItem(ROUND_UNIT_KEY);
    if (!raw) return 1000;
    const val = parseInt(raw, 10);
    return [100, 1000, 10000].includes(val) ? val : 1000;
  } catch {
    return 1000;
  }
}

// ── 프리셋 관리 ──

/**
 * 전체 프리셋 목록 불러오기
 * @returns {Array<{ name: string, data: object, createdAt: string }>}
 */
export function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('프리셋 불러오기 실패:', err);
    return [];
  }
}

/**
 * 프리셋 저장 (이름 중복 시 덮어쓰기)
 * @param {string} name - 프리셋 이름
 * @param {object} data - 저장할 데이터
 * @returns {boolean} 성공 여부
 */
export function savePreset(name, data) {
  try {
    const presets = loadPresets();
    const existIdx = presets.findIndex((p) => p.name === name);
    const entry = {
      name,
      data: JSON.parse(JSON.stringify(data)), // 깊은 복사
      createdAt: new Date().toISOString(),
    };

    if (existIdx >= 0) {
      presets[existIdx] = entry;
    } else {
      presets.push(entry);
    }

    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch (err) {
    console.error('프리셋 저장 실패:', err);
    return false;
  }
}

/**
 * 프리셋 삭제
 * @param {string} name - 삭제할 프리셋 이름
 * @returns {boolean} 성공 여부
 */
export function deletePreset(name) {
  try {
    const presets = loadPresets().filter((p) => p.name !== name);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch (err) {
    console.error('프리셋 삭제 실패:', err);
    return false;
  }
}

/**
 * 프리셋 데이터 불러오기
 * @param {string} name - 프리셋 이름
 * @returns {object|null} 프리셋 데이터 또는 null
 */
export function getPresetData(name) {
  const presets = loadPresets();
  const found = presets.find((p) => p.name === name);
  return found ? found.data : null;
}

// ── JSON 파일 내보내기/가져오기 ──

/**
 * 데이터를 JSON 파일로 다운로드
 * @param {object} data     - 내보낼 데이터
 * @param {string} filename - 파일명 (기본: vans-pricing-export.json)
 */
export function exportToJSON(data, filename = 'vans-pricing-export.json') {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('JSON 내보내기 실패:', err);
    throw err;
  }
}

/**
 * JSON 파일에서 데이터 가져오기
 * @param {File} file - 선택한 JSON 파일
 * @returns {Promise<object>} 파싱된 데이터
 */
export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 선택되지 않았습니다.'));
      return;
    }

    if (!file.name.endsWith('.json')) {
      reject(new Error('JSON 파일만 가져올 수 있습니다.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // 기본 구조 검증
        if (!data || !Array.isArray(data.items)) {
          reject(new Error('올바른 VANS 가격 데이터 형식이 아닙니다.'));
          return;
        }

        resolve(data);
      } catch (parseErr) {
        reject(new Error('JSON 파싱 실패: ' + parseErr.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };

    reader.readAsText(file, 'utf-8');
  });
}
