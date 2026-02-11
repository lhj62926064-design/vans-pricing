/**
 * BulkPackageInput.jsx - 벌크 텍스트 입력으로 패키지 일괄 생성
 *
 * 사용자가 GPT에서 하던 것처럼 텍스트를 붙여넣으면
 * 자동으로 패키지를 파싱하고 가격을 계산합니다.
 */

import { useState } from 'react';
import { parsePackageText, matchProcedurePrices } from '../../utils/packagePricing';

const EXAMPLE_TEXT = `●슈링크300+인모드fx 얼전 690,000원
●파워윤곽주사 3회 99,000원
●슈링크유니버스600+인모드fx 얼전 990,000원
●슈링크300+인모드fx 바디전신 1,200,000원`;

export default function BulkPackageInput({ procedures, onParsed }) {
  const [text, setText] = useState('');

  const handleParse = () => {
    if (!text.trim()) return;
    let parsed = parsePackageText(text);
    // 시술 라이브러리에서 가격 자동 매칭
    parsed = matchProcedurePrices(parsed, procedures);
    onParsed(parsed);
  };

  const handleExample = () => {
    setText(EXAMPLE_TEXT);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">
          패키지 일괄 입력
        </h3>
        <button
          onClick={handleExample}
          className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          예시 보기
        </button>
      </div>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`GPT에서 하던 것처럼 패키지를 붙여넣으세요.\n\n●패키지명 가격원\n●패키지명 가격원\n\n예시:\n●슈링크300+인모드fx 얼전 690,000원\n●파워윤곽주사 3회 99,000원`}
          rows={8}
          className="w-full px-3 py-3 border-2 border-dashed border-indigo-300 rounded-lg text-sm
                     bg-indigo-50/50 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                     font-mono leading-relaxed resize-y"
        />
        <p className="text-xs text-gray-400 mt-1">
          한 줄에 하나의 패키지. ● 또는 - 로 시작, 마지막에 가격.
          시술 라이브러리에 등록된 시술은 정가가 자동 매칭됩니다.
        </p>
      </div>

      <button
        onClick={handleParse}
        disabled={!text.trim()}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg
                   hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors"
      >
        패키지 생성
      </button>
    </div>
  );
}
