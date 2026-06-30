// Compact, reusable "20% OFF" badge. Renders nothing if the event
// doesn't carry an active promotion. Size variants kept tight so it
// composes cleanly into card corners + detail-page headers.

export default function PromotionBadge({ promotion, size = 'sm' }) {
  if (!promotion) return null
  const label = formatPromotionLabel(promotion)
  if (!label) return null

  const sizeClass =
    size === 'lg'
      ? 'text-sm md:text-base px-3 py-1 md:px-3.5 md:py-1.5'
      : size === 'md'
        ? 'text-xs md:text-sm px-2.5 py-0.5 md:px-3 md:py-1'
        : 'text-[10px] px-2 py-0.5'

  return (
    <span
      title={promotion.name || 'Limited-time offer'}
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-pink-600 font-bold uppercase tracking-wide text-white shadow-sm ${sizeClass}`}
    >
      {label}
    </span>
  )
}

export function formatPromotionLabel(promotion) {
  if (!promotion) return ''
  if (promotion.discountType === 'percentage') {
    return `${Math.round(promotion.discountValue)}% OFF`
  }
  if (promotion.discountType === 'fixed') {
    return `$${Math.round(promotion.discountValue)} OFF`
  }
  return 'SALE'
}
