// GET /api/mineru-result?taskId=xxx
// Polls MinerU for task completion status.
// Returns { status: "pending"|"done"|"failed", content?: string, error?: string }

const zlib = require('zlib');

// Minimal ZIP parser — extracts the first .md file found in the archive
function extractMdFromZip(buf) {
  try {
    // Locate End of Central Directory (EOCD) signature 0x06054b50
    let eocdOff = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocdOff = i; break; }
    }
    if (eocdOff < 0) return null;

    const nEntries = buf.readUInt16LE(eocdOff + 10);
    const cdOff    = buf.readUInt32LE(eocdOff + 16);
    let pos = cdOff;

    for (let i = 0; i < nEntries; i++) {
      if (buf.length < pos + 46 || buf.readUInt32LE(pos) !== 0x02014b50) break;
      const comp  = buf.readUInt16LE(pos + 10);
      const csz   = buf.readUInt32LE(pos + 20);
      const fnLen = buf.readUInt16LE(pos + 28);
      const exLen = buf.readUInt16LE(pos + 30);
      const cmLen = buf.readUInt16LE(pos + 32);
      const lhOff = buf.readUInt32LE(pos + 42);
      const name  = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf8');
      pos += 46 + fnLen + exLen + cmLen;

      if (!name.endsWith('.md')) continue;
      if (buf.length < lhOff + 30 || buf.readUInt32LE(lhOff) !== 0x04034b50) continue;

      const lfnLen = buf.readUInt16LE(lhOff + 26);
      const lexLen = buf.readUInt16LE(lhOff + 28);
      const dOff   = lhOff + 30 + lfnLen + lexLen;
      if (buf.length < dOff + csz) continue;

      const cdata = buf.slice(dOff, dOff + csz);
      return comp === 0
        ? cdata.toString('utf8')
        : zlib.inflateRawSync(cdata).toString('utf8');
    }
  } catch {}
  return null;
}

async function fetchAndExtractMd(url) {
  const dl  = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const ct  = (dl.headers.get('content-type') || '').toLowerCase();
  const isZip = ct.includes('zip') || url.includes('.zip');
  if (isZip) {
    const zipBuf = Buffer.from(await dl.arrayBuffer());
    return extractMdFromZip(zipBuf) || '';
  }
  return await dl.text();
}

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

    // Normalise response shape
    const d = raw.data || raw;
    const state = String(d.state || d.status || d.task_status || '').toLowerCase();

    if (state === 'done' || state === 'success' || state === 'finished' || state === 'completed') {
      let content = d.markdown || d.html || d.content || '';

      // 1. output_files array — find a direct .md URL (MinerU v4 common format)
      if (!content) {
        const files = d.extract_result?.output_files || d.output_files || d.files_url || [];
        const mdUrl = files.find(u => String(u).endsWith('.md'));
        if (mdUrl) {
          try { content = await fetchAndExtractMd(String(mdUrl)); } catch {}
        }
      }

      // 2. result_url — may be text or zip
      if (!content && d.result_url) {
        try { content = await fetchAndExtractMd(d.result_url); } catch {}
      }

      // 3. full_zip_url — download zip and parse
      if (!content && d.full_zip_url) {
        try { content = await fetchAndExtractMd(d.full_zip_url); } catch {}
      }

      // 4. nested result object
      if (!content && d.result?.markdown) content = d.result.markdown;
      if (!content && d.result?.html)     content = d.result.html;

      res.json({ status: 'done', content: content.slice(0, 200000) });

    } else if (state === 'failed' || state === 'error' || state === 'fail') {
      res.json({ status: 'failed', error: d.err_msg || d.error || d.message || '解析失败' });
    } else {
      res.json({ status: 'pending', progress: d.progress || null });
    }
  } catch (err) {
    res.status(502).json({ status: 'failed', error: err.message });
  }
}

module.exports = handler;
