/**
 * FloatingCalculator.jsx - 플로팅 계산기
 *
 * 기능:
 *  - position: fixed로 스크롤 따라감 (오른쪽 배치)
 *  - 헤더 드래그로 위치 이동
 *  - 우하단 핸들로 크기 조절
 *  - 기본 사칙연산 + 만원 단위 + VAT 계산
 *  - 접기/열기 토글
 *  - 1400px 미만 화면에서 토글 버튼으로 전환
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { formatNumber } from '../../utils/pricing';

const POS_KEY = 'vans-pricing-calc-pos';
const SIZE_KEY = 'vans-pricing-calc-size';
const MIN_KEY = 'vans-pricing-calc-minimized';

const DEFAULT_SIZE = { width: 280, height: 380 };
const MIN_SIZE = { width: 220, height: 300 };
const MAX_SIZE = { width: 400, height: 600 };

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

function getDefaultPos() {
  return { x: Math.max(0, window.innerWidth - 296), y: 120 };
}

export default function FloatingCalculator() {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');

  const [pos, setPos] = useState(() => loadJSON(POS_KEY, getDefaultPos()));
  const [size, setSize] = useState(() => loadJSON(SIZE_KEY, DEFAULT_SIZE));
  const [minimized, setMinimized] = useState(() => loadJSON(MIN_KEY, false));
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1400);
  const [manualOpen, setManualOpen] = useState(false);

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 1400);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 숫자 입력
  const inputDigit = useCallback((digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit);
    }
  }, [display, waitingForOperand]);

  // 소수점
  const inputDot = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  // 연산
  const calculate = useCallback((left, right, op) => {
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '×': return left * right;
      case '÷': return right !== 0 ? left / right : 0;
      default: return right;
    }
  }, []);

  // 연산자 클릭
  const handleOperator = useCallback((nextOp) => {
    const current = parseFloat(display) || 0;

    if (prevValue !== null && operator && !waitingForOperand) {
      const result = calculate(prevValue, current, operator);
      setDisplay(String(result));
      setPrevValue(result);
      setExpression(`${formatNumber(result)} ${nextOp}`);
    } else {
      setPrevValue(current);
      setExpression(`${formatNumber(current)} ${nextOp}`);
    }

    setOperator(nextOp);
    setWaitingForOperand(true);
  }, [display, prevValue, operator, waitingForOperand, calculate]);

  // = 클릭
  const handleEquals = useCallback(() => {
    const current = parseFloat(display) || 0;
    if (prevValue !== null && operator) {
      const result = calculate(prevValue, current, operator);
      setExpression(`${formatNumber(prevValue)} ${operator} ${formatNumber(current)} =`);
      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  }, [display, prevValue, operator, calculate]);

  // C (전체 초기화)
  const handleClear = useCallback(() => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setExpression('');
  }, []);

  // ⌫ (백스페이스)
  const handleBackspace = useCallback(() => {
    if (waitingForOperand) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  }, [display, waitingForOperand]);

  // ± (부호 전환)
  const toggleSign = useCallback(() => {
    const val = parseFloat(display);
    if (val !== 0) {
      setDisplay(String(-val));
    }
  }, [display]);

  // 만원 (×10000)
  const applyMan = useCallback(() => {
    const val = parseFloat(display) || 0;
    const result = val * 10000;
    setDisplay(String(result));
    setExpression(`${formatNumber(val)} × 만`);
    setWaitingForOperand(true);
  }, [display]);

  // VAT 포함 (×1.1)
  const applyVatPlus = useCallback(() => {
    const val = parseFloat(display) || 0;
    const result = Math.round(val * 1.1);
    setDisplay(String(result));
    setExpression(`${formatNumber(val)} × 1.1`);
    setWaitingForOperand(true);
  }, [display]);

  // VAT 제외 (÷1.1)
  const applyVatMinus = useCallback(() => {
    const val = parseFloat(display) || 0;
    const result = Math.round(val / 1.1);
    setDisplay(String(result));
    setExpression(`${formatNumber(val)} ÷ 1.1`);
    setWaitingForOperand(true);
  }, [display]);

  // 클립보드 복사
  const copyResult = useCallback(async () => {
    try {
      const val = parseFloat(display) || 0;
      await navigator.clipboard.writeText(String(Math.round(val)));
    } catch {}
  }, [display]);

  // 표시값 포맷
  const displayFormatted = (() => {
    const val = parseFloat(display);
    if (isNaN(val)) return display;
    if (display.endsWith('.')) return formatNumber(Math.floor(val)) + '.';
    if (display.includes('.') && !Number.isInteger(val)) {
      const parts = display.split('.');
      return formatNumber(parseInt(parts[0])) + '.' + parts[1];
    }
    return formatNumber(val);
  })();

  // ── 드래그 이동 ──
  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button')) return;
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

  const toggleMinimize = useCallback(() => {
    setMinimized((prev) => {
      const next = !prev;
      saveJSON(MIN_KEY, next);
      return next;
    });
  }, []);

  const toggleManual = useCallback(() => {
    setManualOpen((prev) => !prev);
  }, []);

  const visible = isWide || manualOpen;

  // 좁은 화면 토글 버튼 (오른쪽 하단)
  if (!isWide && !manualOpen) {
    return (
      <button
        onClick={toggleManual}
        className="fixed right-3 bottom-4 z-50 w-10 h-10 bg-blue-500 text-white rounded-full
                   shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center
                   text-lg font-bold"
        title="계산기 열기"
      >
        🔢
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
            className="fixed right-3 bottom-4 z-50 w-10 h-10 bg-gray-400 text-white rounded-full
                       shadow-lg hover:bg-gray-500 transition-colors flex items-center justify-center text-sm"
            title="계산기 닫기"
          >
            ✕
          </button>
        )}
        <div
          className="fixed z-40 select-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <div
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg shadow-lg
                       cursor-move hover:bg-blue-700 transition-colors"
            onMouseDown={handleDragStart}
          >
            <span className="text-sm">🔢</span>
            <span className="text-xs font-bold">계산기</span>
            {display !== '0' && (
              <span className="text-[10px] bg-blue-500 px-1 rounded">{displayFormatted}</span>
            )}
            <button
              onClick={toggleMinimize}
              className="ml-1 text-blue-300 hover:text-white transition-colors text-xs"
              title="펼치기"
            >
              ▢
            </button>
          </div>
        </div>
      </>
    );
  }

  // 버튼 스타일 헬퍼
  const btnNum = "flex items-center justify-center rounded-lg text-sm font-bold transition-colors bg-gray-100 hover:bg-gray-200 text-gray-800 active:bg-gray-300";
  const btnOp = "flex items-center justify-center rounded-lg text-sm font-bold transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 active:bg-blue-300";
  const btnSpecial = "flex items-center justify-center rounded-lg text-xs font-bold transition-colors bg-teal-100 hover:bg-teal-200 text-teal-700 active:bg-teal-300";
  const btnEquals = "flex items-center justify-center rounded-lg text-sm font-bold transition-colors bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800";
  const btnClear = "flex items-center justify-center rounded-lg text-xs font-bold transition-colors bg-red-100 hover:bg-red-200 text-red-600 active:bg-red-300";

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
        {/* 헤더 */}
        <div
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500
                     text-white cursor-move shrink-0 select-none"
          onMouseDown={handleDragStart}
        >
          <span className="text-sm">🔢</span>
          <span className="text-xs font-bold flex-1">계산기</span>
          <button
            onClick={copyResult}
            className="text-blue-200 hover:text-white transition-colors text-[10px] px-1"
            title="결과 복사"
          >
            복사
          </button>
          <button
            onClick={toggleMinimize}
            className="text-blue-200 hover:text-white transition-colors text-xs px-1"
            title="접기"
          >
            ─
          </button>
          {!isWide && (
            <button
              onClick={toggleManual}
              className="text-blue-200 hover:text-white transition-colors text-xs px-1"
              title="닫기"
            >
              ✕
            </button>
          )}
        </div>

        {/* 디스플레이 */}
        <div className="px-3 py-2 bg-gray-900 shrink-0">
          {expression && (
            <div className="text-[10px] text-gray-400 text-right truncate h-4">{expression}</div>
          )}
          <div className="text-right text-xl font-bold text-white font-mono truncate leading-tight">
            {displayFormatted}
          </div>
          {parseFloat(display) >= 10000 && (
            <div className="text-[10px] text-gray-500 text-right">
              {formatNumber(Math.round(parseFloat(display) / 10000 * 10) / 10)}만원
            </div>
          )}
        </div>

        {/* 버튼 그리드 */}
        <div className="flex-1 p-1.5 grid grid-cols-4 gap-1 overflow-hidden" style={{ gridAutoRows: '1fr' }}>
          {/* Row 1: C, ⌫, VAT+, VAT- */}
          <button className={btnClear} onClick={handleClear}>C</button>
          <button className={btnClear} onClick={handleBackspace}>⌫</button>
          <button className={btnSpecial} onClick={applyVatPlus}>+VAT</button>
          <button className={btnSpecial} onClick={applyVatMinus}>-VAT</button>

          {/* Row 2: 7, 8, 9, ÷ */}
          <button className={btnNum} onClick={() => inputDigit(7)}>7</button>
          <button className={btnNum} onClick={() => inputDigit(8)}>8</button>
          <button className={btnNum} onClick={() => inputDigit(9)}>9</button>
          <button className={btnOp} onClick={() => handleOperator('÷')}>÷</button>

          {/* Row 3: 4, 5, 6, × */}
          <button className={btnNum} onClick={() => inputDigit(4)}>4</button>
          <button className={btnNum} onClick={() => inputDigit(5)}>5</button>
          <button className={btnNum} onClick={() => inputDigit(6)}>6</button>
          <button className={btnOp} onClick={() => handleOperator('×')}>×</button>

          {/* Row 4: 1, 2, 3, - */}
          <button className={btnNum} onClick={() => inputDigit(1)}>1</button>
          <button className={btnNum} onClick={() => inputDigit(2)}>2</button>
          <button className={btnNum} onClick={() => inputDigit(3)}>3</button>
          <button className={btnOp} onClick={() => handleOperator('-')}>−</button>

          {/* Row 5: 만, 0, ., + */}
          <button className={btnSpecial} onClick={applyMan}>만</button>
          <button className={btnNum} onClick={() => inputDigit(0)}>0</button>
          <button className={btnNum} onClick={inputDot}>.</button>
          <button className={btnOp} onClick={() => handleOperator('+')}>+</button>

          {/* Row 6: ±, 00, 복사, = */}
          <button className={btnNum} onClick={toggleSign}>±</button>
          <button className={btnNum} onClick={() => { inputDigit(0); inputDigit(0); }}>00</button>
          <button className={btnSpecial} onClick={copyResult}>📋</button>
          <button className={btnEquals} onClick={handleEquals}>=</button>
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
