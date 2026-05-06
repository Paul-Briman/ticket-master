import { emailLayout } from './layout.js'
import { escapeHtml, formatMoney } from '../utils.js'

export function ticketEmail({ order }) {
  const appUrl = process.env.APP_URL || '#'
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(order.id)}`
  const venueLine = order.eventVenue
    ? `${order.eventVenue}, ${order.eventCity || ''}`
    : order.eventCity || ''

  const body = `
    <p style="margin:0 0 6px;color:#2563eb;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tickets Confirmed</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">You're going to ${escapeHtml(order.eventTitle)}!</h1>
    <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(order.user) || 'there'}, your payment is confirmed. Show the QR code below at the gate for entry.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fbff;border:2px dashed #d1d5db;border-radius:10px;margin:8px 0 20px;">
      <tr>
        <td style="padding:20px;">
          <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(order.eventTitle)}</h2>
          <p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(order.eventDate || '')}</p>
          <p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(venueLine)}</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;border-top:1px dashed #e5e7eb;">
            <tr>
              <td style="padding:10px 0 0;width:50%;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Section</div>
                <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(order.section || '')}</div>
              </td>
              <td style="padding:10px 0 0;width:50%;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Row</div>
                <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(order.row ?? '—')}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0 0;width:50%;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Tier</div>
                <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(order.tierLabel || '')}</div>
              </td>
              <td style="padding:10px 0 0;width:50%;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Quantity</div>
                <div style="font-size:14px;font-weight:600;color:#111827;">&times; ${escapeHtml(order.quantity ?? 1)}</div>
              </td>
            </tr>
          </table>

          <div style="text-align:center;margin-top:18px;border-top:1px dashed #e5e7eb;padding-top:18px;">
            <img src="${qrUrl}" alt="Entry QR code" width="170" height="170" style="display:inline-block;border:1px solid #e5e7eb;border-radius:6px;padding:6px;background:#fff;">
            <div style="margin-top:8px;font-size:12px;color:#6b7280;">Scan at venue for entry</div>
            <div style="margin-top:4px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:#9ca3af;">${escapeHtml(order.id)}</div>
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e5e7eb;padding-top:12px;">
      <tr>
        <td style="font-size:14px;color:#374151;font-weight:600;">Total Paid</td>
        <td style="text-align:right;font-size:18px;font-weight:700;color:#2563eb;">${escapeHtml(formatMoney(order.total))}</td>
      </tr>
    </table>

    <a href="${escapeHtml(appUrl)}/my-tickets" style="display:inline-block;margin-top:18px;background:#2563eb;color:#ffffff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Download Ticket</a>
  `

  return emailLayout({
    preview: `Your tickets for ${order.eventTitle} are confirmed`,
    body,
  })
}
