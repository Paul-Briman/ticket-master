import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError, api, decodeToken, getToken, setToken } from './api.js'

const AuthContext = createContext(null)

function userFromToken(token) {
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload) return null
  if (payload.exp && payload.exp * 1000 <= Date.now()) return null
  return {
    name: payload.name,
    email: payload.email,
    role: payload.role || 'user',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const token = getToken()
    const u = userFromToken(token)
    if (u) {
      setUser(u)
    } else if (token) {
      setToken(null)
    }
    setHydrated(true)
  }, [])

  const wrap = useCallback(async (op) => {
    try {
      const data = await op()
      return { ok: true, ...data }
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, error: err.message, data: err.data }
      }
      return { ok: false, error: err.message || 'Unexpected error' }
    }
  }, [])

  const signup = useCallback(
    ({ name, email, password }) =>
      wrap(async () => {
        const res = await api.signup({ name, email, password })
        return { email: res.email, message: res.message }
      }),
    [wrap],
  )

  const verifyOtp = useCallback(
    ({ email, otp }) =>
      wrap(async () => {
        const res = await api.verifyOtp({ email, otp })
        setToken(res.token)
        setUser(res.user)
        return { user: res.user }
      }),
    [wrap],
  )

  const resendOtp = useCallback(
    ({ email }) => wrap(() => api.resendOtp({ email })),
    [wrap],
  )

  const login = useCallback(
    ({ email, password }) =>
      wrap(async () => {
        const res = await api.login({ email, password })
        setToken(res.token)
        setUser(res.user)
        return { user: res.user }
      }),
    [wrap],
  )

  const googleLogin = useCallback(
    ({ accessToken }) =>
      wrap(async () => {
        const res = await api.googleLogin({ accessToken })
        setToken(res.token)
        setUser(res.user)
        return { user: res.user }
      }),
    [wrap],
  )

  const forgotPassword = useCallback(
    ({ email }) => wrap(() => api.forgotPassword({ email })),
    [wrap],
  )

  const resetPassword = useCallback(
    ({ email, otp, newPassword }) =>
      wrap(() => api.resetPassword({ email, otp, newPassword })),
    [wrap],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        hydrated,
        signup,
        verifyOtp,
        resendOtp,
        login,
        googleLogin,
        forgotPassword,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
