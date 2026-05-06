const COLORS = {
  selectedFill: '#2563eb',
  selectedStroke: '#1d4ed8',
  outerFill: '#e5e7eb',
  outerStroke: '#cbd5e1',
  middleFill: '#cbd5e1',
  middleStroke: '#94a3b8',
  innerFill: '#94a3b8',
  innerStroke: '#64748b',
  field: '#16a34a',
  stage: '#1f2937',
}

const STAGE_LABELS = {
  concerts: { vip: 'FRONT ROW', premium: 'FLOOR', standard: 'MEZZANINE' },
  arts: { vip: 'ORCHESTRA', premium: 'MEZZANINE', standard: 'BALCONY' },
  family: { vip: 'ORCHESTRA', premium: 'MEZZANINE', standard: 'BALCONY' },
}

export default function SeatingMap({ category, selectedKey }) {
  if (category === 'sports') {
    return <StadiumMap selectedKey={selectedKey} />
  }
  return <StageMap category={category} selectedKey={selectedKey} />
}

function StadiumMap({ selectedKey }) {
  const sel = (k) => selectedKey === k

  const ring = (key, base) => ({
    fill: sel(key) ? COLORS.selectedFill : base.fill,
    stroke: sel(key) ? COLORS.selectedStroke : base.stroke,
    strokeWidth: sel(key) ? 3 : 1.25,
  })

  const standardStyle = ring('standard', { fill: COLORS.outerFill, stroke: COLORS.outerStroke })
  const premiumStyle = ring('premium', { fill: COLORS.middleFill, stroke: COLORS.middleStroke })
  const vipStyle = ring('vip', { fill: COLORS.innerFill, stroke: COLORS.innerStroke })

  return (
    <svg
      viewBox="0 0 400 320"
      className="h-full w-full"
      role="img"
      aria-label="Stadium seating map"
    >
      <ellipse cx="200" cy="160" rx="190" ry="140" {...standardStyle} className="transition-all duration-300" />
      <ellipse cx="200" cy="160" rx="140" ry="100" {...premiumStyle} className="transition-all duration-300" />
      <ellipse cx="200" cy="160" rx="90" ry="60" {...vipStyle} className="transition-all duration-300" />

      <rect x="160" y="146" width="80" height="28" rx="3" fill={COLORS.field} />
      <text x="200" y="164" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff" letterSpacing="1.5">
        FIELD
      </text>

      <text x="200" y="36" textAnchor="middle" fontSize="11" fontWeight="700"
        fill={sel('standard') ? '#ffffff' : '#374151'} letterSpacing="2">
        STANDARD
      </text>
      <text x="200" y="80" textAnchor="middle" fontSize="10" fontWeight="700"
        fill={sel('premium') ? '#ffffff' : '#374151'} letterSpacing="2">
        PREMIUM
      </text>
      <text x="200" y="118" textAnchor="middle" fontSize="9" fontWeight="700"
        fill={sel('vip') ? '#ffffff' : '#1f2937'} letterSpacing="2">
        VIP
      </text>
    </svg>
  )
}

function StageMap({ category, selectedKey }) {
  const labels = STAGE_LABELS[category] || STAGE_LABELS.concerts
  const sel = (k) => selectedKey === k

  const zone = (key, base) => ({
    fill: sel(key) ? COLORS.selectedFill : base.fill,
    stroke: sel(key) ? COLORS.selectedStroke : base.stroke,
    strokeWidth: sel(key) ? 3 : 1.25,
  })

  const vipStyle = zone('vip', { fill: COLORS.innerFill, stroke: COLORS.innerStroke })
  const premiumStyle = zone('premium', { fill: COLORS.middleFill, stroke: COLORS.middleStroke })
  const standardStyle = zone('standard', { fill: COLORS.outerFill, stroke: COLORS.outerStroke })

  return (
    <svg
      viewBox="0 0 400 340"
      className="h-full w-full"
      role="img"
      aria-label="Stage seating map"
    >
      <rect x="80" y="20" width="240" height="40" rx="4" fill={COLORS.stage} />
      <text x="200" y="46" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" letterSpacing="3">
        STAGE
      </text>

      <path d="M125 75 L275 75 L290 130 L110 130 Z" {...vipStyle} className="transition-all duration-300" />
      <text x="200" y="108" textAnchor="middle" fontSize="11" fontWeight="700"
        fill={sel('vip') ? '#ffffff' : '#1f2937'} letterSpacing="2">
        {labels.vip}
      </text>

      <path d="M110 140 L290 140 L320 215 L80 215 Z" {...premiumStyle} className="transition-all duration-300" />
      <text x="200" y="183" textAnchor="middle" fontSize="12" fontWeight="700"
        fill={sel('premium') ? '#ffffff' : '#1f2937'} letterSpacing="2">
        {labels.premium}
      </text>

      <path d="M80 225 L320 225 L380 320 L20 320 Z" {...standardStyle} className="transition-all duration-300" />
      <text x="200" y="280" textAnchor="middle" fontSize="11" fontWeight="700"
        fill={sel('standard') ? '#ffffff' : '#374151'} letterSpacing="2">
        {labels.standard}
      </text>
    </svg>
  )
}
