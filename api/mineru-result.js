// GET /api/mineru-result?taskId=xxx
// Polls MinerU for task completion status.
// Returns { status: "pending"|"done"|"failed", content?: string, error?: string }

async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end('Method Not Allowed'); return; }

  const apiKey = process.env.MINERU_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'MINERU_API_KEY 未配置' }); return; }

  const taskId = (req.query && req.query.taskId) ||
    new URL('http://x' + req.url).searchParams.get('taskId');
  if (!taskId) { res.status(400).json({ error: '缺少 taskId 参数' }); return; }

  try {
    const pollRes = await fetch(`https://mineru.net/api/v4/extract/task/${encodeURIComponent(taskId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });

    const raw = await pollRes.json();

    if (!pollRes.ok) {
      res.json({ status: 'failed', error: raw.msg || raw.message || 'HTTP ' + pollRes.status });
      return;
    }

    // Normalise across different possible response shapes
    const d = raw.data || raw;
    const state = String(d.state || d.status || d.task_status || '').toLowerCase();

    if (state === 'done' || state === 'success' || state === 'finished' || state === 'completed') {
      // Collect content from whichever field MinerU uses
      let content = d.markdown || d.html || d.content || '';

      // If content is a URL rather than inline text, fetch it
      if (!content && d.result_url) {
        try {
          const dl = await fetch(d.result_url, { signal: AbortSignal.timeout(20000) });
          content = await dl.text();
        } catch { content = ''; }
      }
      if (!content && d.result?.markdown) content = d.result.markdown;
      if (!content && d.result?.html)     content = d.result.html;

      res.json({ status: 'done', content: content.slice(0, 200000) });
    } else if (state === 'failed' || state === 'error' || state === 'fail') {
      res.json({ status: 'failed', error: d.err_msg || d.error || d.message || '解析失败' });
    } else {
      // running / pending / queued — keep polling
      res.json({ status: 'pending', progress: d.progress || null });
    }
  } catch (err) {
    res.status(502).json({ status: 'failed', error: err.message });
  }
}

module.exports = handler;
