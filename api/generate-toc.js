// POST { content: string, range: string }
// Feeds MinerU output + user range description to Gemini.
// Returns { chapters: [{title, sections:[{title, subsections:[{title}]}]}] }

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY 未配置' }); return; }

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

  const { content, range } = body;
  if (!content) { res.status(400).json({ error: '缺少 content 字段' }); return; }

  // Truncate to keep within Gemini token budget
  const truncated = content.slice(0, 50000);
  const rangeHint = (range || '').trim();

  const prompt =
`你是专业的学术教材目录结构分析专家。

以下是一本教材转换后的内容（Markdown 或 HTML 格式）：

<content>
${truncated}
</content>

${rangeHint
  ? `用户指定的章节范围（请只提取此范围内的内容）：${rangeHint}`
  : '请提取文档中的全部章节。'}

任务：根据上述内容，生成结构化的章节目录，直接输出 JSON 数组，不要有任何代码块标记或说明文字。

输出格式（严格遵守）：
[
  {
    "title": "第3章 微分方程",
    "sections": [
      {
        "title": "3.1 微分方程的基本概念",
        "subsections": [
          { "title": "3.1.1 微分方程的定义" },
          { "title": "3.1.2 微分方程的阶" }
        ]
      },
      {
        "title": "3.2 一阶线性微分方程",
        "subsections": []
      }
    ]
  }
]

规则：
1. title 字段直接使用原文标题，不修改、不翻译
2. 如果某节没有子节，subsections 为空数组 []
3. 最多三层结构：章 → 节 → 子节
4. 只输出 JSON，无其他内容`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const gemRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!gemRes.ok) {
      const errText = await gemRes.text();
      let msg = errText;
      try { msg = JSON.parse(errText).error?.message || errText; } catch {}
      res.status(gemRes.status).json({ error: 'Gemini 错误：' + msg }); return;
    }

    const gemData = await gemRes.json();
    let text = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip optional code fences Gemini sometimes adds
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let chapters;
    try {
      chapters = JSON.parse(text);
    } catch {
      // If Gemini returned something with surrounding prose, try to extract JSON array
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new Error('Gemini 返回格式不正确，无法解析 JSON');
      chapters = JSON.parse(m[0]);
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      res.status(500).json({ error: '未能提取到章节，请尝试调整范围描述' }); return;
    }

    res.json({ chapters });
  } catch (err) {
    res.status(500).json({ error: 'TOC 生成失败：' + err.message });
  }
}

module.exports = handler;
