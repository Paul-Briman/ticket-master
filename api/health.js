export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    method: req.method,
    timestamp: new Date().toISOString(),
    kvEnabled: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
    resendConfigured: !!process.env.RESEND_API_KEY,
  })
}
