import { emailLayout } from './layout.js'
import { escapeHtml } from '../utils.js'

export function otpEmail({ name, otp, expiresInMinutes = 10 }) {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your account</h1>
    <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(name) || 'there'}, use the code below to verify your Ticketmaster account.
      This code expires in ${expiresInMinutes} minutes.
    </p>
    <div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
      <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#2563eb;font-family:'SFMono-Regular',Consolas,Menlo,monospace;">${escapeHtml(otp)}</div>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
      Didn't request this? You can safely ignore this email &mdash; your account remains secure.
    </p>
  `
  return emailLayout({
    preview: `Your Ticketmaster verification code is ${otp}`,
    body,
  })
}
