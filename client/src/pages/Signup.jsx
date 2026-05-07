import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import Button from '../components/Button.jsx'
import GoogleLoginButton from '../components/GoogleLoginButton.jsx'
import AuthDivider from '../components/AuthDivider.jsx'
import { useAuth } from '../lib/auth.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function Signup() {
  const { signup, googleLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'
  const fromState = location.state?.fromState || null

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  const busy = submitting || googleSubmitting

  function validate() {
    const next = {}
    if (!name.trim()) next.name = 'Full name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    else if (password.length < 6) next.password = 'Password must be at least 6 characters.'
    if (!confirm) next.confirm = 'Please confirm your password.'
    else if (password !== confirm) next.confirm = 'Passwords do not match.'
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    const result = await signup({ name, email, password })
    setSubmitting(false)

    if (!result.ok) {
      setFormError(result.error)
      return
    }
    navigate('/verify-otp', {
      replace: true,
      state: { email: result.email || email, redirectTo, fromState },
    })
  }

  async function handleGoogle(accessToken) {
    setFormError('')
    setGoogleSubmitting(true)
    const result = await googleLogin({ accessToken })
    setGoogleSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    navigate(redirectTo, { replace: true, state: fromState })
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col px-4 py-10 md:py-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm md:p-9">
          <div className="text-center">
            <Link
              to="/"
              className="inline-block rounded-md bg-brand px-3 py-1 text-lg font-bold italic text-white shadow-sm"
            >
              ticketmaster<sup className="text-[0.55em]">®</sup>
            </Link>
            <h1 className="mt-5 text-2xl font-bold text-gray-900">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Sign up to buy tickets, save events, and manage orders.
            </p>
          </div>

          {GOOGLE_ENABLED && (
            <>
              <div className="mt-6">
                <GoogleLoginButton
                  onSuccess={handleGoogle}
                  onError={setFormError}
                  disabled={busy}
                  label="Sign up with Google"
                />
              </div>
              <AuthDivider>or sign up with email</AuthDivider>
            </>
          )}

          <form
            onSubmit={handleSubmit}
            className={GOOGLE_ENABLED ? 'flex flex-col gap-4' : 'mt-6 flex flex-col gap-4'}
            noValidate
          >
            <Input
              label="Full Name"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              autoComplete="name"
              disabled={busy}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              disabled={busy}
            />
            <PasswordInput
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="new-password"
              disabled={busy}
            />
            <PasswordInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
              autoComplete="new-password"
              disabled={busy}
            />

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={busy}
            >
              {submitting ? 'Sending verification code...' : 'Create Account'}
            </Button>

            <p className="text-center text-xs text-gray-400">
              We'll email a 6-digit code to verify your address. By signing
              up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-brand hover:text-brand-dark"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
