import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import Button from '../components/Button.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function ResetPassword() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const initialEmail = location.state?.email || ''

  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!email.trim() || !otp.trim() || !newPassword) {
      setError('All fields are required.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const result = await resetPassword({ email, otp, newPassword })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setInfo('Password updated. Redirecting to login...')
    setTimeout(() => navigate('/login', { replace: true }), 1200)
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col px-4 py-12 md:py-20">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter the 6-digit code we sent to your email and choose a new password.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label="Verification Code"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
            />
            <Input
              label="New Password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {info}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            <Link
              to="/login"
              className="font-semibold text-brand hover:text-brand-dark"
            >
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
