import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import Button from '../components/Button.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function VerifyOtp() {
  const { verifyOtp, resendOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email
  const redirectTo = location.state?.redirectTo || '/'
  const fromState = location.state?.fromState || null

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (!email) {
    return <Navigate to="/signup" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    const code = otp.trim()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setSubmitting(true)
    const result = await verifyOtp({ email, otp: code })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(redirectTo, { replace: true, state: fromState })
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setResending(true)
    const result = await resendOtp({ email })
    setResending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setInfo('A new code has been sent. Check your inbox.')
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col px-4 py-12 md:py-20">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="mt-1 text-sm text-gray-500">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-gray-900">{email}</span>. Enter
            it below to activate your account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <Input
              ref={inputRef}
              label="Verification Code"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-brand">
                {info}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-medium text-brand hover:text-brand-dark disabled:opacity-60"
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
            <Link to="/login" className="text-gray-500 hover:text-gray-700">
              Use a different account
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            Codes expire in 10 minutes. Check your spam folder if you don’t
            see it.
          </p>
        </div>
      </div>
    </div>
  )
}
