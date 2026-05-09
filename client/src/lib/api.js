const TOKEN_KEY = 'tm_token'
const API_BASE = import.meta.env.VITE_API_BASE || ''

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function decodeToken(token) {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new ApiError('Network error. Check your connection.', 0)
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text()

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && data.error) ||
      (typeof data === 'string' ? data : null) ||
      res.statusText ||
      'Request failed'
    throw new ApiError(message, res.status, data)
  }
  return data
}

export const api = {
  signup: (body) => request('/api/signup', { method: 'POST', body, auth: false }),
  verifyOtp: (body) => request('/api/verify-otp', { method: 'POST', body, auth: false }),
  resendOtp: (body) => request('/api/resend-otp', { method: 'POST', body, auth: false }),
  login: (body) => request('/api/login', { method: 'POST', body, auth: false }),
  googleLogin: (body) => request('/api/google-login', { method: 'POST', body, auth: false }),
  forgotPassword: (body) => request('/api/forgot-password', { method: 'POST', body, auth: false }),
  resetPassword: (body) => request('/api/reset-password', { method: 'POST', body, auth: false }),

  createOrder: (body) => request('/api/create-order', { method: 'POST', body }),
  myOrders: () => request('/api/my-orders'),

  adminOrders: () => request('/api/admin-orders'),
  confirmPayment: (orderId) =>
    request('/api/confirm-payment', { method: 'POST', body: { orderId } }),

  sportsEvents: (params = {}) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
    })
    const qs = search.toString()
    return request(`/api/sports${qs ? `?${qs}` : ''}`, { auth: false })
  },

  sportsEvent: (id) =>
    request(`/api/sports/${encodeURIComponent(id)}`, { auth: false }),

  concerts: (params = {}) => fetchEndpointList('/api/concerts', params),
  arts: (params = {}) => fetchEndpointList('/api/arts', params),
  family: (params = {}) => fetchEndpointList('/api/family', params),
}

function fetchEndpointList(path, params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  })
  const qs = search.toString()
  return request(`${path}${qs ? `?${qs}` : ''}`, { auth: false })
}
