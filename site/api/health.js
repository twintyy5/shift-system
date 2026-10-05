export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).json({ ok: true, service: "shift-system-v2", version: "3.0.0" });
}
