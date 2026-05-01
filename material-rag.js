(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MaterialRAG = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const INDEX_VERSION = 46;
  const HEADING_RE = /^(#{1,6})\s+(.+)\s*$/;
  const SECTION_RE = /(?:^|\b|§|第\s*)(\d+(?:\.\d+)+)\s*(?:节|section)?/i;
  const CHAPTER_RE = /(?:chapter|第)\s*(\d+)\s*(?:章)?/i;
  const ITEM_RE = /(?:exercise|problem|习题|题目|第)\s*\.?\s*(\d+)\s*(?:题)?/i;
  const BARE_ITEM_RE = /^\s*\(?(\d{1,3})\)?[\.)]\s+\S/;
  const PAGE_RE = /(?:page|p\.)\s*\.?\s*(\d{1,4})\b|第\s*(\d{1,4})\s*页/i;
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
    const s = String(text || '');
    const match = s.match(ITEM_RE) || s.match(BARE_ITEM_RE);
    return match ? match[1] : '';
  }

  function detectPage(text) {
    const match = String(text || '').match(PAGE_RE);
    return match ? (match[1] || match[2] || '') : '';
  }

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function collectRegexPositions(text, regex) {
    const positions = [];
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) && positions.length < 80) {
      positions.push(match.index);
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }
    return positions;
  }

  function lineAround(text, index) {
    const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1);
    const endAt = text.indexOf('\n', index);
    const end = endAt === -1 ? text.length : endAt;
    return text.slice(start, end);
  }

  function isLikelyTocLine(line) {
    return /\b(table of contents|contents)\b/i.test(line) || /\.{3,}/.test(line);
  }

  function extractTocTitle(line, sectionNo, pageNo) {
    let title = String(line || '').replace(/^#+\s*/, '').trim();
    if (sectionNo) title = title.replace(new RegExp(`^\\s*${escapeRegExp(sectionNo)}\\s*`), '');
    title = title.replace(/\.{3,}.*$/, '');
    if (pageNo) title = title.replace(new RegExp(`\\s+${escapeRegExp(pageNo)}\\s*$`), '');
    title = title.replace(/\s+\d{1,4}\s*$/, '').trim();
    return title.length >= 8 ? title : '';
  }

  function titleSearchRegex(title) {
    const parts = normalizeSpaces(title).split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (!parts.length) return null;
    return new RegExp(parts.join('\\s+'), 'gi');
  }

  function inferDocType(fileName, text) {
    const n = String(fileName || '').toLowerCase();
    const sample = String(text || '').slice(0, 4000).toLowerCase();
    if (/\b(arxiv|abstract|references|doi:|introduction)\b/.test(sample)) return 'paper';
    if (/\b(slide|lecture slides|speaker notes)\b/.test(sample) || /\.(pptx?|slides?)\.md$/.test(n)) return 'slides';
    if (/\b(exercise|problem|chapter|table of contents|习题|题目|第\s*\d+\s*章)\b/i.test(sample)) return 'textbook';
    return 'unknown';
  }

  function inferBlockType(path, text, itemNo) {
    const joinedPath = (path || []).join(' ').toLowerCase();
    const sample = String(text || '').slice(0, 600).toLowerCase();
    if (/\b(table of contents|contents)\b/.test(joinedPath) || /\btable of contents\b/.test(sample)) return 'toc';
    if (/\b(abstract)\b/.test(joinedPath)) return 'abstract';
    if (/\b(references|bibliography)\b/.test(joinedPath)) return 'references';
    if (/\b(slide|speaker notes)\b/.test(joinedPath)) return 'slide';
    if (itemNo || /\b(exercises?|problems?)\b/.test(joinedPath) || /(?:习题|题目)/.test(joinedPath)) return 'exercise';
    return joinedPath ? 'section' : 'paragraph';
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
      const trimmed = line.trim();
      if (/^\d+\.\d+\b/.test(trimmed)) return false;
      return /^(?:\s*)(?:Exercise|Problem|习题|题目|第\s*\d+\s*题)\s*\.?\s*\d*/i.test(trimmed) ||
        BARE_ITEM_RE.test(trimmed);
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
    const docType = inferDocType(fileName, text);
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
          const pathText = currentPath.join(' ');
          const contentSample = part.slice(0, 500);
          const sectionNo = detectSection(pathText);
          const itemNo = detectItem(part);
          chunks.push({
            id: `${fileId || fileName || 'file'}::${chunkIndex}`,
            indexVersion: INDEX_VERSION,
            courseId,
            fileId,
            fileName,
            docType,
            blockType: inferBlockType(currentPath, part, itemNo),
            headingPath: currentPath.slice(),
            chapterNo: detectChapter(pathText),
            sectionNo,
            itemNo,
            pageNo: detectPage(contentSample),
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

  const ZH_DIGIT = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

  function toArabic(str) {
    const n = parseInt(str, 10);
    if (!isNaN(n)) return String(n);
    if (ZH_DIGIT[str] !== undefined) return String(ZH_DIGIT[str]);
    if (str === '十') return '10';
    if (str.startsWith('十') && ZH_DIGIT[str[1]] !== undefined) return String(10 + ZH_DIGIT[str[1]]);
    if (str.length === 2 && str[1] === '十' && ZH_DIGIT[str[0]] !== undefined) return String(ZH_DIGIT[str[0]] * 10);
    if (str.length === 3 && str[1] === '十' && ZH_DIGIT[str[0]] !== undefined && ZH_DIGIT[str[2]] !== undefined)
      return String(ZH_DIGIT[str[0]] * 10 + ZH_DIGIT[str[2]]);
    return str;
  }

  const FORMULA_REF_RE = /(?:公式|equation|formula|fig(?:ure)?|图|表|table|eq)[.\s(（]*\d+\.\d+/gi;
  const ZH_CHAPTER_SECTION_RE = /第\s*([零一二三四五六七八九十\d]+)\s*章\s*第\s*([零一二三四五六七八九十\d]+)\s*节/i;
  const EN_CHAPTER_SECTION_RE = /chapter\s+(\d+)\s+section\s+(\d+)/i;

  function extractQueryHints(query) {
    let q = normalizeSpaces(query);

    // Strip formula/figure/table references so their X.Y numbers aren't mistaken for section numbers
    q = q.replace(FORMULA_REF_RE, ' ');

    // Normalize "第三章第四节" / "第3章第4节" → "3.4"
    const zhMatch = q.match(ZH_CHAPTER_SECTION_RE);
    if (zhMatch) q = q.replace(ZH_CHAPTER_SECTION_RE, toArabic(zhMatch[1]) + '.' + toArabic(zhMatch[2]));

    // Normalize "chapter 3 section 4" → "3.4"
    const enMatch = q.match(EN_CHAPTER_SECTION_RE);
    if (enMatch) q = q.replace(EN_CHAPTER_SECTION_RE, enMatch[1] + '.' + enMatch[2]);

    const sectionNo = detectSection(q);
    const itemNo = detectItem(q);
    const pageNo = detectPage(q);
    const keywords = q
      .replace(SECTION_RE, ' ')
      .replace(ITEM_RE, ' ')
      .replace(PAGE_RE, ' ')
      .split(/[\s,，。；;:：!?？()（）]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s && s.length > 1 && !STOP_WORDS.has(s));
    return { sectionNo, itemNo, pageNo, keywords };
  }

  function buildTargetedExcerpt(text, query, opts = {}) {
    const source = String(text || '');
    const maxChars = opts.maxChars || 28000;
    const beforeChars = opts.beforeChars || 2500;
    const hints = extractQueryHints(query || '');
    const candidates = [];

    function addCandidate(index, score, reason) {
      if (index < 0 || index >= source.length) return;
      const line = lineAround(source, index);
      const adjustedScore = score - (isLikelyTocLine(line) ? 120 : 0) + (index > 20000 ? 15 : 0);
      candidates.push({ index, score: adjustedScore, reason });
    }

    if (hints.sectionNo) {
      const sectionRe = new RegExp(escapeRegExp(hints.sectionNo), 'g');
      for (const pos of collectRegexPositions(source, sectionRe)) {
        const line = lineAround(source, pos);
        const isHeading = /^#{1,6}\s+/.test(line);
        const contextBefore = source.slice(Math.max(0, pos - 25), pos);
        const isNonSectionRef = /(?:公式|equation|formula|fig(?:ure)?|图|表|table|eq)[.\s(（]*$/i.test(contextBefore);
        const score = isHeading ? 120 : isNonSectionRef ? 0 : 70;
        addCandidate(pos, score, 'section');
        if (isLikelyTocLine(line)) {
          const title = extractTocTitle(line, hints.sectionNo, hints.pageNo);
          const titleRe = titleSearchRegex(title);
          if (titleRe) {
            const restStart = Math.min(source.length, pos + line.length);
            const rest = source.slice(restStart);
            for (const titlePos of collectRegexPositions(rest, titleRe).slice(0, 12)) {
              addCandidate(restStart + titlePos, 150, 'toc-title');
            }
          }
        }
      }
    }

    if (hints.pageNo) {
      const pageRe = new RegExp(`(?:page|p\\.)\\s*\\.?\\s*${escapeRegExp(hints.pageNo)}\\b|第\\s*${escapeRegExp(hints.pageNo)}\\s*页`, 'gi');
      for (const pos of collectRegexPositions(source, pageRe)) addCandidate(pos, 65, 'page');
    }

    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    let anchor = candidates[0] || { index: 0, reason: 'prefix' };

    if (hints.itemNo) {
      const itemRe = new RegExp(`(?:exercise|problem|习题|题目|第)\\s*\\.?\\s*${escapeRegExp(hints.itemNo)}\\s*(?:题)?|^\\s*\\(?${escapeRegExp(hints.itemNo)}\\)?[\\.)]\\s+`, 'gim');
      const searchStart = Math.max(0, anchor.index);
      const searchEnd = Math.min(source.length, searchStart + 90000);
      const local = source.slice(searchStart, searchEnd);
      const localPositions = collectRegexPositions(local, itemRe);
      if (localPositions.length) {
        anchor = { index: searchStart + localPositions[0], reason: 'item' };
      }
    }

    const start = Math.max(0, anchor.index - beforeChars);
    const end = Math.min(source.length, start + maxChars);
    return {
      text: source.slice(start, end),
      start,
      end,
      reason: anchor.reason,
      truncatedBefore: start > 0,
      truncatedAfter: end < source.length,
    };
  }

  function scoreChunk(hints, chunk) {
    const heading = (chunk.headingPath || []).join(' ').toLowerCase();
    const content = String(chunk.content || '').toLowerCase();
    let score = 0;
    if (hints.sectionNo && chunk.sectionNo === hints.sectionNo) score += 100;
    else if (hints.sectionNo && (heading.includes(hints.sectionNo) || content.includes(hints.sectionNo))) score += 45;
    if (hints.itemNo && chunk.itemNo === hints.itemNo) score += 80;
    else if (hints.itemNo && new RegExp(`(?:exercise|problem|习题|题目|第)\\s*\\.?\\s*${hints.itemNo}\\s*(?:题)?`, 'i').test(content)) score += 35;
    else if (hints.itemNo && new RegExp(`^\\s*\\(?${hints.itemNo}\\)?[\\.)]\\s+`, 'm').test(content)) score += 35;
    for (const kw of hints.keywords) {
      if (heading.includes(kw)) score += 12;
      if (content.includes(kw)) score += 4;
    }
    if (chunk.blockType === 'exercise') score += 18;
    if (chunk.blockType === 'toc') score -= 80;
    return score;
  }

  function chunkHasItem(chunk, itemNo) {
    if (!itemNo) return false;
    if (chunk.itemNo === itemNo) return true;
    const content = String(chunk.content || '');
    return new RegExp(`(?:exercise|problem|习题|题目|第)\\s*\\.?\\s*${escapeRegExp(itemNo)}\\s*(?:题)?`, 'i').test(content) ||
      new RegExp(`^\\s*\\(?${escapeRegExp(itemNo)}\\)?[\\.)]\\s+`, 'm').test(content);
  }

  function chunkMatchesSection(chunk, sectionNo) {
    return chunk.sectionNo === sectionNo ||
      (chunk.headingPath || []).join(' ').includes(sectionNo) ||
      String(chunk.content || '').includes(sectionNo);
  }

  function needsTargetedExcerpt(query, matches) {
    const hints = extractQueryHints(query || '');
    if (!hints.itemNo || !matches || !matches.length) return false;
    if (hints.sectionNo) {
      return !matches.some(match =>
        chunkHasItem(match, hints.itemNo) && chunkMatchesSection(match, hints.sectionNo)
      );
    }
    return !matches.some(match => chunkHasItem(match, hints.itemNo));
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
    INDEX_VERSION,
    chunkMarkdownMaterial,
    extractQueryHints,
    buildTargetedExcerpt,
    needsTargetedExcerpt,
    rankMaterialChunks,
    formatRetrievedContext,
  };
});
