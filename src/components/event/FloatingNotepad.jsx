/**
 * FloatingNotepad.jsx - 플로팅 스티키 메모장
 *
 * 기능:
 *  - position: fixed로 스크롤 따라감
 *  - 헤더 드래그로 위치 이동
 *  - 우하단 핸들로 크기 조절
 *  - textarea 자유 메모 (localStorage 자동 저장)
 *  - 접기/열기 토글
 *  - 1400px 미만 화면에서 토글 버튼으로 전환
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'vans-pricing-floating-memo';
const POS_KEY = 'vans-pricing-memo-pos';
const SIZE_KEY = 'vans-pricing-memo-size';
const MIN_KEY = 'vans-pricing-memo-minimized';

const DEFAULT_POS = { x: 16, y: 120 };
const DEFAULT_SIZE = { width: 280, height: 400 };
const MIN_SIZE = { width: 200, height: 150 };
const MAX_SIZE = { width: 500, height: 800 };

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function FloatingNotepad() {
  const [content, setContent] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [pos, setPos] = useState(() => loadJSON(POS_KEY, DEFAULT_POS));
  const [size, setSize] = useState(() => loadJSON(SIZE_KEY, DEFAULT_SIZE));
  const [minimized, setMinimized] = useState(() => loadJSON(MIN_KEY, false));
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1400);
  const [manualOpen, setManualOpen] = useState(false);

  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const saveTimerRef = useRef(null);

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 1400);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 메모 내용 디바운스 저장
  const handleContentChange = useCallback((e) => {
    const val = e.target.value;
    setContent(val);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, val); } catch {}
    }, 500);
  }, []);

  // ── 드래그 이동 ──
  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button')) return; // 버튼 클릭 무시
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;

    const handleMove = (ev) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 100, ev.clientX - startX));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, ev.clientY - startY));
      setPos({ x: newX, y: newY });
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      setPos((p) => { saveJSON(POS_KEY, p); return p; });
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [pos]);

  // ── 리사이즈 ──
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;

    const handleMove = (ev) => {
      const newW = Math.max(MIN_SIZE.width, Math.min(MAX_SIZE.width, startW + (ev.clientX - startX)));
      const newH = Math.max(MIN_SIZE.height, Math.min(MAX_SIZE.height, startH + (ev.clientY - startY)));
      setSize({ width: newW, height: newH });
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      setSize((s) => { saveJSON(SIZE_KEY, s); return s; });
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [size]);

  // 접기/열기
  const toggleMinimize = useCallback(() => {
    setMinimized((prev) => {
      const next = !prev;
      saveJSON(MIN_KEY, next);
      return next;
    });
  }, []);

  // 좁은 화면에서 수동 토글
  const toggleManual = useCallback(() => {
    setManualOpen((prev) => !prev);
  }, []);

  const visible = isWide || manualOpen;

  // 좁은 화면 토글 버튼
  if (!isWide && !manualOpen) {
    return (
      <button
        onClick={toggleManual}
        className="fixed left-3 bottom-4 z-50 w-10 h-10 bg-amber-500 text-white rounded-full
                   shadow-lg hover:bg-amber-600 transition-colors flex items-center justify-center
                   text-lg font-bold"
        title="메모장 열기"
      >
        📝
      </button>
    );
  }

  // 최소화 상태
  if (minimized) {
    return (
      <>
        {!isWide && (
          <button
            onClick={toggleManual}
            className="fixed left-3 bottom-4 z-50 w-10 h-10 bg-gray-400 text-white rounded-full
                       shadow-lg hover:bg-gray-500 transition-colors flex items-center justify-center text-sm"
            title="메모장 닫기"
          >
            ✕
          </button>
        )}
        <div
          className="fixed z-40 select-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <div
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg shadow-lg
                       cursor-move hover:bg-amber-600 transition-colors"
            onMouseDown={handleDragStart}
          >
            <span className="text-sm">📝</span>
            <span className="text-xs font-bold">메모장</span>
            {content.length > 0 && (
              <span className="text-[10px] bg-amber-400 px-1 rounded">{content.split('\n').length}줄</span>
            )}
            <button
              onClick={toggleMinimize}
              className="ml-1 text-amber-200 hover:text-white transition-colors text-xs"
              title="펼치기"
            >
              ▢
            </button>
          </div>
        </div>
      </>
    );
  }

  // 전체 메모장
  return (
    <>
      {!isWide && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={toggleManual}
        />
      )}
      <div
        className="fixed z-40 select-none flex flex-col bg-white border border-gray-300 rounded-lg shadow-2xl overflow-hidden"
        style={{
          left: pos.x,
          top: pos.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* 헤더 - 드래그 이동 */}
        <div
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-400
                     text-white cursor-move shrink-0 select-none"
          onMouseDown={handleDragStart}
        >
          <span className="text-sm">📝</span>
          <span className="text-xs font-bold flex-1">메모장</span>
          {content.length > 0 && (
            <span className="text-[10px] bg-amber-400/60 px-1.5 py-0.5 rounded">
              {content.length}자
            </span>
          )}
          <button
            onClick={toggleMinimize}
            className="text-amber-200 hover:text-white transition-colors text-xs px-1"
            title="접기"
          >
            ─
          </button>
          {!isWide && (
            <button
              onClick={toggleManual}
              className="text-amber-200 hover:text-white transition-colors text-xs px-1"
              title="닫기"
            >
              ✕
            </button>
          )}
        </div>

        {/* 메모 입력 */}
        <textarea
          value={content}
          onChange={handleContentChange}
          className="flex-1 px-3 py-2 text-sm text-gray-700 resize-none
                     focus:outline-none overflow-y-auto leading-relaxed
                     placeholder-gray-400"
          placeholder="자유롭게 메모하세요...&#10;&#10;패키지 구성 아이디어, 가격 메모 등"
          spellCheck={false}
        />

        {/* 하단 상태바 */}
        <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 shrink-0">
          <span>
            {content.length > 0
              ? `${content.split('\n').length}줄 · ${content.length}자`
              : '빈 메모'}
          </span>
          <button
            onClick={() => { setContent(''); try { localStorage.removeItem(STORAGE_KEY); } catch {} }}
            className="text-gray-400 hover:text-red-500 transition-colors px-1"
            title="메모 지우기"
          >
            지우기
          </button>
        </div>

        {/* 우하단 리사이즈 핸들 */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize
                     flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
          onMouseDown={handleResizeStart}
          title="크기 조절"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </>
  );
}
