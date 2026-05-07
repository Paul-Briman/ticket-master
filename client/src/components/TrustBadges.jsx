const Badge = ({ icon, label, sub }) => (
  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
    <span
      aria-hidden
      className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-brand"
    >
      {icon}
    </span>
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-gray-900">{label}</span>
      {sub && <span className="text-[11px] text-gray-500">{sub}</span>}
    </div>
  </div>
)

const Verified = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12l2 2 4-4" />
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const Lock = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)

const Star = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

export default function TrustBadges() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Badge icon={Verified} label="Verified Seller" sub="Authenticated tickets" />
      <Badge icon={Lock} label="Secure Checkout" sub="On-chain verified" />
      <Badge icon={Star} label="Official Partner" sub="100% guaranteed entry" />
    </div>
  )
}
