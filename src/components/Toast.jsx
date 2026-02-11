import { useEffect } from 'react';

export default function Toast({ message, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                    bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg
                    text-sm font-medium animate-bounce-in">
      {message}
    </div>
  );
}
