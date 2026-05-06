import { emailLayout } from './layout.js'
import { escapeHtml } from '../utils.js'

export function welcomeEmail({ name }) {
  const appUrl = process.env.APP_URL || '#'
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome to Ticketmaster!</h1>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(name) || 'there'}, your account is verified and ready. You can now book tickets for World Cup matches, concerts, theater, and family events across the United States and beyond.
    </p>
    <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0 0;">Browse events</a>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
      We'll notify you when a payment is confirmed and your tickets are ready.
    </p>
  `
  return emailLayout({
    preview: 'Welcome to Ticketmaster — your account is ready',
    body,
  })
}
