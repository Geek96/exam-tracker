// POST { content: string, range: string }
// Feeds MinerU output + user range description to Gemini.
// Returns { chapters: [{title, sections:[{title, subsections:[{title}]}]}] }

// Model chain — all on v1beta; dated versions are more stable than aliases
const MODELS = [
  { id: 'gemini-3-flash-preview',           api: 'v1beta' },
  { id: 'gemini-2.5-flash-preview-04-17',   api: 'v1beta' },
  { id: 'gemini-2.5-flash',                 api: 'v1beta' },
  { id: 'gemini-2.0-flash-lite',            api: 'v1beta' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Robust JSON cleaner: strips fences, trailing commas, BOM, control chars
function parseGeminiJson(raw) {
  let text = raw
    .replace(/^﻿/, '')                    // BOM
    .replace(/^```(?:json)?\s*/im, '')         // opening fence
    .replace(/\s*```\s*$/m, '')                // closing fence
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // stray control chars
    .trim();

  // Strip trailing commas before } or ]
  text = text.replace(/,(\s*[}\]])/g, '$1');

  // Direct parse attempt
  try { return JSON.parse(text); } catch {}

  // Extract outermost [...] and retry
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    const cleaned = m[0].replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(cleaned); } catch {}
  }

  throw new Error('无法从 Gemini 响应中解析 JSON');
}

async function callGemini(apiKey, { id: model, api = 'v1beta' }, prompt) {
  const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(45000),
  });

  const status = res.status;

  if (status === 503 || status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
    throw Object.assign(new Error(`模型过载 (${status})`), { retryable: true, retryAfter });
  }

  if (!res.ok) {
    const errText = await res.text();
    let msg = errText;
    try { msg = JSON.parse(errText).error?.message || errText; } catch {}
    throw new Error('Gemini 错误：' + msg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini 返回内容为空');
  return text;
}

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

  const errs = [];

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawText = await callGemini(apiKey, model, prompt);
        const chapters = parseGeminiJson(rawText);

        if (!Array.isArray(chapters) || chapters.length === 0) {
          throw new Error('未能提取到章节，请尝试调整范围描述');
        }

        res.json({ chapters });
        return;

      } catch (err) {
        if (err.retryable) {
          const wait = err.retryAfter ? err.retryAfter * 1000 : 2000 * (attempt + 1);
          await sleep(Math.min(wait, 5000));
          continue;
        }
        errs.push(`[${model.id}] ${err.message}`);
        break;
      }
    }
  }

  res.status(500).json({ error: 'TOC 生成失败（所有模型均失败）：\n' + errs.join('\n') });
}

module.exports = handler;
