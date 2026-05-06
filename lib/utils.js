export function escapeHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]))
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function generateOrderId() {
  const ts = Date.now().toString(36)
  const rand = Math.floor(Math.random() * 0xfff).toString(36)
  return `ord-${ts}-${rand}`
}

export function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}
