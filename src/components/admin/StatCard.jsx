export default function StatCard({ label, value, hint, icon }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1.5 text-3xl font-bold text-gray-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-xl">
            {icon}
          </span>
        )}
      </div>
    </div>
  )
}
