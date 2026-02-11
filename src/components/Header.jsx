export default function Header({ roundUnit, onRoundUnitChange }) {
  return (
    <header
      className="text-white px-4 py-4 shadow-lg print:bg-white print:text-black print:shadow-none"
      style={{ backgroundColor: 'var(--color-header-bg)' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
          VANS Clinic 가격 책정 시스템
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="roundUnit" className="text-gray-300 print:text-gray-600">
            반올림:
          </label>
          <select
            id="roundUnit"
            value={roundUnit}
            onChange={(e) => onRoundUnitChange(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400
                       print:bg-white print:text-black print:border-gray-300"
          >
            <option value={100} className="text-black">100원 단위</option>
            <option value={1000} className="text-black">1,000원 단위</option>
            <option value={10000} className="text-black">10,000원 단위</option>
          </select>
        </div>
      </div>
    </header>
  );
}
