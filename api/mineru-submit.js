// POST { pdfBase64: string, filename: string }
// 1. Uploads PDF to tmpfiles.org (gets public URL)
// 2. Submits URL to MinerU API
// Returns { taskId: string }

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  const apiKey = process.env.MINERU_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'MINERU_API_KEY 未在环境变量中配置' }); return; }

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

  const { pdfBase64, filename = 'upload.pdf', fileType = 'pdf' } = body;
  if (!pdfBase64) { res.status(400).json({ error: '缺少 pdfBase64 字段' }); return; }

  const isHtml = fileType === 'html';
  const mimeType    = isHtml ? 'text/html'        : 'application/pdf';
  const modelVersion = isHtml ? 'MinerU-HTML'     : 'pipeline';

  let pdfBuf;
  try { pdfBuf = Buffer.from(pdfBase64, 'base64'); }
  catch { res.status(400).json({ error: 'base64 解码失败' }); return; }

  if (pdfBuf.length > 3.5 * 1024 * 1024) {
    res.status(413).json({ error: `文件过大（${(pdfBuf.length / 1024 / 1024).toFixed(1)}MB），AI 提取仅支持 3.5MB 以内的文件` });
    return;
  }

  // Build safe filename
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 100) || (isHtml ? 'upload.html' : 'upload.pdf');

  // Upload to tmpfiles.org via multipart form
  const boundary = '----MinerUBound' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const headerPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFilename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
  const formBody = Buffer.concat([headerPart, pdfBuf, footerPart]);

  let pdfUrl;
  try {
    const upRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(formBody.length),
      },
      body: formBody,
      signal: AbortSignal.timeout(30000),
    });
    if (!upRes.ok) throw new Error('HTTP ' + upRes.status);
    const upData = await upRes.json();
    if (upData.status !== 'success' || !upData.data?.url) throw new Error('上传服务返回异常');
    // tmpfiles.org URLs: /XXXX/file.pdf → /dl/XXXX/file.pdf for direct download
    pdfUrl = upData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  } catch (err) {
    res.status(502).json({ error: '文件临时上传失败：' + err.message }); return;
  }

  // Submit to MinerU
  try {
    const minRes = await fetch('https://mineru.net/api/v4/extract/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url: pdfUrl, model_version: modelVersion }),
      signal: AbortSignal.timeout(20000),
    });
    const minData = await minRes.json();
    if (!minRes.ok || (minData.code !== undefined && minData.code !== 0)) {
      throw new Error(minData.msg || minData.message || `HTTP ${minRes.status}`);
    }
    // MinerU returns task ID in data field
    const taskId = minData.data || minData.task_id || minData.taskId;
    if (!taskId) throw new Error('MinerU 未返回任务ID');
    res.json({ taskId: String(taskId) });
  } catch (err) {
    res.status(502).json({ error: 'MinerU 提交失败：' + err.message });
  }
}

module.exports = handler;
