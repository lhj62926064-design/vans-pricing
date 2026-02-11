const TABS = [
  { key: 'pricing', label: '수가 책정', icon: '📊' },
  { key: 'event', label: '한정 이벤트', icon: '🎯' },
];

export default function MainTabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-1 print:hidden">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-t-lg text-sm font-bold
            transition-colors border border-b-0
            ${activeTab === tab.key
              ? 'bg-white text-gray-800 border-gray-300'
              : 'bg-gray-200 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
            }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
