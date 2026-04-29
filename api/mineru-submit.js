// POST { url: string, filename: string, fileType: string }
// Submits a publicly-accessible file URL directly to MinerU API.
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

  const { url: fileUrl, filename = 'upload.pdf', fileType = 'pdf' } = body;
  if (!fileUrl) { res.status(400).json({ error: '缺少 url 字段' }); return; }

  const isHtml = fileType === 'html';
  const modelVersion = isHtml ? 'MinerU-HTML' : 'pipeline';

  try {
    const minRes = await fetch('https://mineru.net/api/v4/extract/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url: fileUrl, model_version: modelVersion }),
      signal: AbortSignal.timeout(20000),
    });
    const minData = await minRes.json();
    if (!minRes.ok || (minData.code !== undefined && minData.code !== 0)) {
      throw new Error(minData.msg || minData.message || `HTTP ${minRes.status}`);
    }
    const rd = minData.data;
    const taskId =
      (rd && typeof rd === 'string'  ? rd : null) ||
      (rd && typeof rd === 'object'  ? (rd.task_id || rd.taskId || rd.id) : null) ||
      minData.task_id || minData.taskId;
    if (!taskId) throw new Error('MinerU 未返回任务ID');
    res.json({ taskId: String(taskId) });
  } catch (err) {
    res.status(502).json({ error: 'MinerU 提交失败：' + err.message });
  }
}

module.exports = handler;
