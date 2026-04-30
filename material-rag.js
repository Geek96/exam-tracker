(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MaterialRAG = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const HEADING_RE = /^(#{1,6})\s+(.+)\s*$/;
  const SECTION_RE = /(?:^|\b|§|第\s*)(\d+(?:\.\d+)+)\s*(?:节|section)?/i;
  const CHAPTER_RE = /(?:chapter|第)\s*(\d+)\s*(?:章)?/i;
  const ITEM_RE = /(?:exercise|problem|习题|题目|第)\s*\.?\s*(\d+)\s*(?:题)?/i;
  const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'please', 'solve', '帮我', '请', '一下', '这个']);

  function normalizeSpaces(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function detectSection(text) {
    const match = String(text || '').match(SECTION_RE);
    return match ? match[1] : '';
  }

  function detectChapter(text) {
    const match = String(text || '').match(CHAPTER_RE);
    return match ? match[1] : '';
  }

  function detectItem(text) {
    const match = String(text || '').match(ITEM_RE);
    return match ? match[1] : '';
  }

  function safeSplitBlocks(text) {
    const blocks = [];
    const lines = String(text || '').split('\n');
    let buf = [];
    let inFence = false;
    let inMath = false;

    function flush() {
      if (!buf.length) return;
      blocks.push(buf.join('\n').trim());
      buf = [];
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) inFence = !inFence;
      if (!inFence && trimmed === '$$') inMath = !inMath;

      if (!inFence && !inMath && trimmed === '') {
        flush();
        continue;
      }
      buf.push(line);
    }
    flush();
    return blocks.filter(Boolean);
  }

  function splitOversized(text, maxChars, overlap) {
    if (text.length <= maxChars) return [text];
    const blocks = safeSplitBlocks(text);
    const chunks = [];
    let current = '';

    for (const block of blocks) {
      if (!current) {
        current = block;
      } else if ((current + '\n\n' + block).length <= maxChars) {
        current += '\n\n' + block;
      } else {
        chunks.push(current);
        const tail = current.slice(Math.max(0, current.length - overlap));
        current = tail ? tail + '\n\n' + block : block;
      }

      while (current.length > maxChars * 2) {
        chunks.push(current.slice(0, maxChars));
        current = current.slice(Math.max(0, maxChars - overlap));
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function splitExerciseBlocks(sectionText) {
    const lines = String(sectionText || '').split('\n');
    const blocks = [];
    let current = [];

    function isItemStart(line) {
      return /^(?:\s*)(?:Exercise|Problem|习题|题目|第\s*\d+\s*题)\s*\.?\s*\d*/i.test(line.trim());
    }

    function flush() {
      if (!current.length) return;
      blocks.push(current.join('\n').trim());
      current = [];
    }

    for (const line of lines) {
      if (isItemStart(line) && current.length) flush();
      current.push(line);
    }
    flush();
    return blocks.length > 1 ? blocks : [sectionText.trim()].filter(Boolean);
  }

  function chunkMarkdownMaterial({ fileId, courseId, fileName, text, maxChars = 4000, overlap = 400 }) {
    const chunks = [];
    const headingStack = [];
    let currentLines = [];
    let currentPath = [];
    let chunkIndex = 0;

    function emit() {
      const raw = currentLines.join('\n').trim();
      if (!raw) return;
      const itemBlocks = splitExerciseBlocks(raw);
      for (const itemBlock of itemBlocks) {
        for (const part of splitOversized(itemBlock, maxChars, overlap)) {
          const metadataText = currentPath.join(' ') + ' ' + part.slice(0, 500);
          const sectionNo = detectSection(metadataText);
          chunks.push({
            id: `${fileId || fileName || 'file'}::${chunkIndex}`,
            courseId,
            fileId,
            fileName,
            headingPath: currentPath.slice(),
            chapterNo: detectChapter(metadataText),
            sectionNo,
            itemNo: detectItem(part),
            content: part,
            chunkIndex: chunkIndex++,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    for (const line of String(text || '').split('\n')) {
      const heading = line.match(HEADING_RE);
      if (heading) {
        emit();
        const level = heading[1].length;
        headingStack.length = level - 1;
        headingStack[level - 1] = normalizeSpaces(heading[2]);
        currentPath = headingStack.filter(Boolean);
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
    }
    emit();
    return chunks;
  }

  function extractQueryHints(query) {
    const q = normalizeSpaces(query);
    const sectionNo = detectSection(q);
    const itemNo = detectItem(q);
    const keywords = q
      .replace(SECTION_RE, ' ')
      .replace(ITEM_RE, ' ')
      .split(/[\s,，。；;:：!?？()（）]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s && s.length > 1 && !STOP_WORDS.has(s));
    return { sectionNo, itemNo, keywords };
  }

  function scoreChunk(hints, chunk) {
    const heading = (chunk.headingPath || []).join(' ').toLowerCase();
    const content = String(chunk.content || '').toLowerCase();
    let score = 0;
    if (hints.sectionNo && chunk.sectionNo === hints.sectionNo) score += 100;
    else if (hints.sectionNo && (heading.includes(hints.sectionNo) || content.includes(hints.sectionNo))) score += 45;
    if (hints.itemNo && chunk.itemNo === hints.itemNo) score += 80;
    else if (hints.itemNo && new RegExp(`(?:exercise|problem|习题|题目|第)\\s*\\.?\\s*${hints.itemNo}\\s*(?:题)?`, 'i').test(content)) score += 35;
    for (const kw of hints.keywords) {
      if (heading.includes(kw)) score += 12;
      if (content.includes(kw)) score += 4;
    }
    return score;
  }

  function rankMaterialChunks(query, chunks, limit = 6) {
    const hints = extractQueryHints(query);
    return (chunks || [])
      .map(chunk => ({ ...chunk, score: scoreChunk(hints, chunk) }))
      .filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score || (a.chunkIndex || 0) - (b.chunkIndex || 0))
      .slice(0, limit);
  }

  function formatRetrievedContext(matches) {
    if (!matches || !matches.length) return '';
    const body = matches.map((m, i) => {
      const path = (m.headingPath || []).join(' > ') || '未识别章节';
      const meta = [
        `文件：${m.fileName || '未知文件'}`,
        `位置：${path}`,
        m.sectionNo ? `章节：${m.sectionNo}` : '',
        m.itemNo ? `题号：${m.itemNo}` : '',
      ].filter(Boolean).join('；');
      return `[片段 ${i + 1}] ${meta}\n${m.content}`;
    }).join('\n\n---\n\n');
    return `课程资料检索片段：\n${body}`;
  }

  return {
    chunkMarkdownMaterial,
    extractQueryHints,
    rankMaterialChunks,
    formatRetrievedContext,
  };
});
