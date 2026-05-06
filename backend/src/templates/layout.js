import { escapeHtml } from '../utils.js'

export function emailLayout({ preview = '', body }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Ticketmaster</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preview)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#2563eb;padding:24px;text-align:center;">
              <span style="display:inline-block;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:6px;font-size:18px;font-weight:700;color:#ffffff;font-style:italic;letter-spacing:0.3px;">ticketmaster<sup style="font-size:10px;font-style:normal;">&reg;</sup></span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
              ticketmaster&reg; &middot; You're receiving this because you have an account with us.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
