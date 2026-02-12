import { useEffect } from 'react';

export default function Toast({ message, onClose, onUndo }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, onUndo ? 5000 : 2500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose, onUndo]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                    bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg
                    text-sm font-medium animate-bounce-in flex items-center gap-3">
      <span>{message}</span>
      {onUndo && (
        <button
          onClick={() => { onUndo(); onClose(); }}
          className="px-2.5 py-1 bg-yellow-500 text-gray-900 rounded text-xs font-bold
                     hover:bg-yellow-400 transition-colors shrink-0"
        >
          되돌리기
        </button>
      )}
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-white transition-colors ml-1 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
