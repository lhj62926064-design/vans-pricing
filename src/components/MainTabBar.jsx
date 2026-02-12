const TABS = [
  { key: 'pricing', label: '수가 책정', icon: '📊' },
  { key: 'event', label: '한정 이벤트', icon: '🎯' },
  { key: 'branch', label: '지점 수가', icon: '🏥' },
];

export default function MainTabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-1 print:hidden">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-t-lg text-sm font-bold
            transition-colors border border-b-0 relative
            ${activeTab === tab.key
              ? 'bg-white text-teal-700 border-gray-300 shadow-sm'
              : 'bg-gray-200 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
            }`}
        >
          {activeTab === tab.key && (
            <span className="absolute top-0 left-2 right-2 h-0.5 bg-teal-500 rounded-b" />
          )}
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
