import { createContext, useContext, useEffect, useState } from 'react'

const USERS_KEY = 'tm_users'
const SESSION_KEY = 'tm_session'

const DEFAULT_ADMIN = {
  name: 'Admin',
  email: 'admin@ticket.com',
  password: '123456',
  role: 'admin',
}

const AuthContext = createContext(null)

function readUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map((u) => ({ role: 'user', ...u }))
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function writeSession(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_KEY)
}

function ensureDefaultAdmin() {
  const users = readUsers()
  const exists = users.some(
    (u) => u.email.toLowerCase() === DEFAULT_ADMIN.email.toLowerCase(),
  )
  if (!exists) {
    users.push(DEFAULT_ADMIN)
    writeUsers(users)
  } else {
    let mutated = false
    const next = users.map((u) => {
      if (u.email.toLowerCase() === DEFAULT_ADMIN.email.toLowerCase() && u.role !== 'admin') {
        mutated = true
        return { ...u, role: 'admin' }
      }
      return u
    })
    if (mutated) writeUsers(next)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    ensureDefaultAdmin()

    const session = readSession()
    if (session && !session.role) {
      const users = readUsers()
      const match = users.find(
        (u) => u.email.toLowerCase() === session.email.toLowerCase(),
      )
      const next = { ...session, role: match?.role || 'user' }
      writeSession(next)
      setUser(next)
    } else {
      setUser(session)
    }
  }, [])

  function signup({ name, email, password }) {
    const users = readUsers()
    const existing = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    )
    if (existing) {
      return { ok: false, error: 'An account with this email already exists.' }
    }
    const newUser = {
      name: name.trim(),
      email: email.trim(),
      password,
      role: 'user',
    }
    users.push(newUser)
    writeUsers(users)

    const session = {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    }
    writeSession(session)
    setUser(session)
    return { ok: true }
  }

  function login({ email, password }) {
    const users = readUsers()
    const match = users.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password,
    )
    if (!match) {
      return { ok: false, error: 'Invalid email or password.' }
    }
    const session = {
      name: match.name,
      email: match.email,
      role: match.role || 'user',
    }
    writeSession(session)
    setUser(session)
    return { ok: true }
  }

  function logout() {
    writeSession(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
