/**
 * branchStorage.js - 지점 수가 데이터 localStorage CRUD
 *
 * 저장 구조:
 *   'vans-branch-manifest' → { branches: [{name, importedAt, rowCount}], activeBranch: string|null }
 *   'vans-branch-data-{지점명}' → [{no, category, name, standardPrice, taxable}]
 */

const MANIFEST_KEY = 'vans-branch-manifest';
const DATA_KEY_PREFIX = 'vans-branch-data-';

// ── Memory Cache ──
const _cache = new Map();
let _manifestCache = null;

export function invalidateCache(branchName) {
  if (branchName) {
    _cache.delete(branchName);
  } else {
    _cache.clear();
  }
  _manifestCache = null;
}

// ── Manifest ──

export function loadManifest() {
  if (_manifestCache) return _manifestCache;
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (raw) {
      _manifestCache = JSON.parse(raw);
      return _manifestCache;
    }
  } catch (err) {
    console.error('manifest 로드 실패:', err);
  }
  _manifestCache = { branches: [], activeBranch: null };
  return _manifestCache;
}

function saveManifest(manifest) {
  _manifestCache = manifest;
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch (err) {
    console.error('manifest 저장 실패:', err);
  }
}

// ── Active Branch ──

export function getActiveBranch() {
  return loadManifest().activeBranch;
}

export function setActiveBranch(branchName) {
  const manifest = loadManifest();
  manifest.activeBranch = branchName;
  saveManifest(manifest);
}

// ── Branch Data CRUD ──

export function saveBranchData(branchName, procedures) {
  invalidateCache(branchName);
  const key = DATA_KEY_PREFIX + branchName;
  try {
    localStorage.setItem(key, JSON.stringify(procedures));
  } catch (err) {
    console.error(`지점 데이터 저장 실패 (${branchName}):`, err);
    throw new Error('localStorage 용량이 부족합니다. 일부 지점 데이터를 삭제해주세요.');
  }

  // manifest 업데이트
  const manifest = loadManifest();
  const existing = manifest.branches.findIndex((b) => b.name === branchName);
  const entry = {
    name: branchName,
    importedAt: new Date().toISOString(),
    rowCount: procedures.length,
  };

  if (existing >= 0) {
    manifest.branches[existing] = entry;
  } else {
    manifest.branches.push(entry);
  }

  if (!manifest.activeBranch) {
    manifest.activeBranch = branchName;
  }

  saveManifest(manifest);
}

export function loadBranchData(branchName) {
  if (!branchName) return [];
  if (_cache.has(branchName)) return _cache.get(branchName);
  try {
    const raw = localStorage.getItem(DATA_KEY_PREFIX + branchName);
    const data = raw ? JSON.parse(raw) : [];
    _cache.set(branchName, data);
    return data;
  } catch (err) {
    console.error(`지점 데이터 로드 실패 (${branchName}):`, err);
    return [];
  }
}

export function deleteBranchData(branchName) {
  invalidateCache(branchName);
  try {
    localStorage.removeItem(DATA_KEY_PREFIX + branchName);
  } catch {}

  const manifest = loadManifest();
  manifest.branches = manifest.branches.filter((b) => b.name !== branchName);
  if (manifest.activeBranch === branchName) {
    manifest.activeBranch = manifest.branches.length > 0 ? manifest.branches[0].name : null;
  }
  saveManifest(manifest);
}

export function deleteAllBranchData() {
  invalidateCache();
  const manifest = loadManifest();
  for (const branch of manifest.branches) {
    try {
      localStorage.removeItem(DATA_KEY_PREFIX + branch.name);
    } catch {}
  }
  saveManifest({ branches: [], activeBranch: null });
}

// ── Query ──

export function getBranchNames() {
  return loadManifest().branches.map((b) => b.name);
}

export function hasBranch(branchName) {
  return loadManifest().branches.some((b) => b.name === branchName);
}

/**
 * 지점 시술 검색/필터
 * @param {string} branchName
 * @param {{ query?: string, category?: string }} filters
 * @returns {Array}
 */
export function searchBranchProcedures(branchName, { query = '', category = '' } = {}) {
  const data = loadBranchData(branchName);
  if (!query && !category) return data;

  const q = query.replace(/\s+/g, '').toLowerCase();

  return data.filter((item) => {
    if (category && item.category !== category) return false;
    if (q && !item.name.replace(/\s+/g, '').toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * 지점 데이터에서 카테고리 목록 추출
 * @param {Array} data - loadBranchData() 결과
 * @returns {string[]} 고유 카테고리 배열
 */
export function extractCategories(data) {
  const set = new Set();
  for (const item of data) {
    if (item.category) set.add(item.category.trim());
  }
  return [...set].sort();
}

// ── Storage Stats ──

export function getBranchStorageStats() {
  const manifest = loadManifest();
  let totalRows = 0;
  let estimatedSizeKB = 0;

  for (const branch of manifest.branches) {
    totalRows += branch.rowCount || 0;
    try {
      const raw = localStorage.getItem(DATA_KEY_PREFIX + branch.name);
      if (raw) estimatedSizeKB += raw.length / 1024;
    } catch {}
  }

  // manifest 자체 크기
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (raw) estimatedSizeKB += raw.length / 1024;
  } catch {}

  return {
    totalBranches: manifest.branches.length,
    totalRows,
    estimatedSizeKB: Math.round(estimatedSizeKB),
  };
}

/**
 * 전체 지점 데이터에서 시술 비교
 * @param {string} procedureName - 검색할 시술명
 * @returns {Array<{ branch: string, name: string, standardPrice: number, category: string }>}
 */
export function compareProcedureAcrossBranches(procedureName) {
  if (!procedureName) return [];
  const manifest = loadManifest();
  const results = [];
  const normalized = procedureName.replace(/\s+/g, '').toLowerCase();

  for (const branch of manifest.branches) {
    const data = loadBranchData(branch.name);
    const match = data.find((p) => {
      const pNorm = p.name.replace(/\s+/g, '').toLowerCase();
      return pNorm === normalized || pNorm.includes(normalized) || normalized.includes(pNorm);
    });
    if (match) {
      results.push({
        branch: branch.name,
        name: match.name,
        standardPrice: match.standardPrice,
        category: match.category,
      });
    }
  }

  return results.sort((a, b) => a.standardPrice - b.standardPrice);
}

/**
 * 전 지점에서 시술명 자동완성 검색 (한 글자부터)
 * 이름 중복 제거 후 query 포함 항목 반환
 * @param {string} query - 검색어
 * @param {number} limit - 최대 결과 수
 * @returns {Array<{ name: string, category: string, branches: Array<{ branch: string, price: number }> }>}
 */
export function searchProceduresAcrossAllBranches(query, limit = 20) {
  if (!query || !query.trim()) return [];
  const manifest = loadManifest();
  const q = query.replace(/\s+/g, '').toLowerCase();

  // 모든 지점 데이터를 name 기준으로 합침
  const nameMap = new Map(); // key: normalized name, value: { name, category, branches }

  for (const branch of manifest.branches) {
    const data = loadBranchData(branch.name);
    for (const item of data) {
      const norm = item.name.replace(/\s+/g, '').toLowerCase();
      if (!norm.includes(q)) continue;

      if (!nameMap.has(norm)) {
        nameMap.set(norm, {
          name: item.name,
          category: item.category || '',
          branches: [],
        });
      }
      nameMap.get(norm).branches.push({
        branch: branch.name,
        price: item.standardPrice,
      });
    }
  }

  return [...nameMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit);
}

/**
 * 여러 시술 동시 비교
 * @param {string[]} procedureNames - 비교할 시술명 배열
 * @param {string[]} branchFilter - 선택된 지점 (빈 배열이면 전체)
 * @returns {Array<{ name: string, category: string, prices: { [branchName]: number } }>}
 */
export function compareMultipleProcedures(procedureNames, branchFilter = []) {
  if (!procedureNames || procedureNames.length === 0) return [];
  const manifest = loadManifest();
  const branches = branchFilter.length > 0
    ? manifest.branches.filter((b) => branchFilter.includes(b.name))
    : manifest.branches;

  // 각 지점의 데이터를 한번만 로드
  const branchDataMap = new Map();
  for (const branch of branches) {
    branchDataMap.set(branch.name, loadBranchData(branch.name));
  }

  return procedureNames.map((procName) => {
    const normalized = procName.replace(/\s+/g, '').toLowerCase();
    const prices = {};
    let category = '';

    for (const [branchName, data] of branchDataMap) {
      const match = data.find((p) => {
        const pNorm = p.name.replace(/\s+/g, '').toLowerCase();
        return pNorm === normalized || pNorm.includes(normalized) || normalized.includes(pNorm);
      });
      if (match) {
        prices[branchName] = match.standardPrice;
        if (!category && match.category) category = match.category;
      }
    }

    return { name: procName, category, prices };
  });
}
