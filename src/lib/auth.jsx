import { createContext, useContext, useEffect, useState } from 'react'

const USERS_KEY = 'tm_users'
const SESSION_KEY = 'tm_session'

const AuthContext = createContext(null)

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser(readSession())
  }, [])

  function signup({ name, email, password }) {
    const users = readUsers()
    const existing = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    )
    if (existing) {
      return { ok: false, error: 'An account with this email already exists.' }
    }
    const newUser = { name: name.trim(), email: email.trim(), password }
    users.push(newUser)
    writeUsers(users)

    const session = { name: newUser.name, email: newUser.email }
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
    const session = { name: match.name, email: match.email }
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
