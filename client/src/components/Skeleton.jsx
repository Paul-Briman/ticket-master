export function SkeletonBlock({ className = '' }) {
  return (
    <div
      className={`tm-shimmer rounded-md bg-gray-200 ${className}`}
      aria-hidden
    />
  )
}

export function SkeletonCard() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      aria-hidden
    >
      <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="h-3 w-2/3" />
        <SkeletonBlock className="mt-2 h-4 w-20" />
      </div>
    </div>
  )
}

export function SkeletonRow({ height = 'h-14' }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg border border-gray-100 bg-white p-3 ${height}`}
      aria-hidden
    >
      <SkeletonBlock className="h-10 w-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonBlock className="h-3 w-1/3" />
        <SkeletonBlock className="h-3 w-1/2" />
      </div>
      <SkeletonBlock className="h-4 w-16" />
    </div>
  )
}

export function SkeletonGrid({ count = 6, className = '' }) {
  return (
    <div
      className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
