// POST { filename, mimeType, data (base64) }
// Server-side proxy: decodes base64 file and uploads to a temporary hosting service.
// Avoids browser CORS restrictions since the upload is done server-to-server.
// Returns { url: string }
//
// Size limit: ~3 MB raw (base64 overhead ≈ 33% → stays under Vercel's 4.5 MB body cap).
// For larger files the client falls back to direct browser upload.

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      const raw = await new Promise((resolve, reject) => {
        let d = '';
        req.on('data', c => { d += c; });
        req.on('end', () => resolve(d));
        req.on('error', reject);
      });
      body = JSON.parse(raw);
    } catch { res.status(400).json({ error: '请求格式无效' }); return; }
  }

  const { filename = 'upload.pdf', mimeType = 'application/pdf', data: b64 } = body;
  if (!b64) { res.status(400).json({ error: '缺少 data 字段' }); return; }

  let buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch { res.status(400).json({ error: 'base64 解码失败' }); return; }

  const SERVICES = [
    async () => {
      const blob = new Blob([buffer], { type: mimeType });
      const fd = new FormData();
      fd.append('reqtype', 'fileupload');
      fd.append('time', '72h');
      fd.append('fileToUpload', blob, filename);
      const r = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST', body: fd, signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`litterbox HTTP ${r.status}`);
      const url = (await r.text()).trim();
      if (!url.startsWith('https://')) throw new Error('litterbox: ' + url.slice(0, 80));
      return url;
    },
    async () => {
      const blob = new Blob([buffer], { type: mimeType });
      const fd = new FormData();
      fd.append('file', blob, filename);
      const r = await fetch('https://0x0.st', {
        method: 'POST', body: fd, signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`0x0.st HTTP ${r.status}`);
      const url = (await r.text()).trim();
      if (!url.startsWith('https://')) throw new Error('0x0.st: ' + url.slice(0, 80));
      return url;
    },
  ];

  let lastErr;
  for (const service of SERVICES) {
    try {
      const url = await service();
      res.json({ url });
      return;
    } catch (e) {
      lastErr = e;
      console.warn('[upload-proxy fallback]', e.message);
    }
  }
  res.status(502).json({ error: '所有上传服务均失败：' + (lastErr ? lastErr.message : '未知错误') });
}

module.exports = handler;
