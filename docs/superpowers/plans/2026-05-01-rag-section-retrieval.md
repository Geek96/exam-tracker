# RAG 章节检索修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 RAG 返回错误章节内容的根本原因，并支持多形式章节查询写法。

**Architecture:** 全部改动在 `material-rag.js` 一个文件内，分三个独立函数：(1) `chunkMarkdownMaterial` 只从标题路径提取 `sectionNo`；(2) `extractQueryHints` 先剥离公式/图编号再归一化多形式章节写法；(3) `buildTargetedExcerpt` 对非标题行的章节号命中降权为 0。测试用 Node.js 内置 `node:test`，与现有测试文件格式一致。

**Tech Stack:** 纯浏览器 Vanilla JS，Node.js `node:test`（仅测试），无构建步骤。

---

## 文件改动清单

| 文件 | 操作 |
|---|---|
| `material-rag.js` | 修改（4 处）|
| `tests/material-rag.test.js` | 修改（新增 5 个测试）|
| `course.html` | 修改（版本号 v45→v46）|
| `STATUS.md` | 修改（版本号与变更记录）|

---

## Task 1：为 sectionNo 标题路径限制添加失败测试

**Files:**
- Modify: `tests/material-rag.test.js`

- [ ] **Step 1：在测试文件末尾追加以下测试**

打开 `tests/material-rag.test.js`，在最后一个 `test(...)` 块之后追加：

```js
// ── 新增测试：改动 1 ──────────────────────────────────────────────────────

test('chunkMarkdownMaterial does not pollute sectionNo from equation or figure refs in content', () => {
  const md = `# Chapter 2

## Mixing Problems

The substance satisfies equation (3.4): dT/dt = k(T - M).
See also Figure 3.4 for the phase portrait.

1. Solve the mixing problem.
`;
  const chunks = chunkMarkdownMaterial({
    fileId: 'f', courseId: 'c', fileName: 'ch2.md', text: md,
  });
  const ch2Chunk = chunks.find(c => (c.headingPath || []).some(h => h.includes('Mixing')));
  assert.ok(ch2Chunk, 'expected a Chapter 2 chunk');
  assert.equal(ch2Chunk.sectionNo, '', 'sectionNo must not be set by equation (3.4) in content');
});
```

- [ ] **Step 2：运行测试，确认新测试失败，现有测试全部通过**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：新测试 FAIL（`sectionNo` 被 content 污染），其他测试 PASS。

---

## Task 2：实现 chunkMarkdownMaterial — sectionNo 仅从标题路径提取

**Files:**
- Modify: `material-rag.js:189-214`

- [ ] **Step 1：找到 `emit()` 函数内的 `metadataText` 行，替换如下**

定位（约第 195 行）：
```js
        const metadataText = currentPath.join(' ') + ' ' + part.slice(0, 500);
        const sectionNo = detectSection(metadataText);
        const itemNo = detectItem(part);
        chunks.push({
          ...
          chapterNo: detectChapter(metadataText),
          sectionNo,
          itemNo,
          pageNo: detectPage(metadataText),
```

替换为：
```js
        const pathText = currentPath.join(' ');
        const contentSample = part.slice(0, 500);
        const sectionNo = detectSection(pathText);
        const itemNo = detectItem(part);
        chunks.push({
          ...
          chapterNo: detectChapter(pathText),
          sectionNo,
          itemNo,
          pageNo: detectPage(contentSample),
```

- [ ] **Step 2：运行测试，确认所有测试通过**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：全部 PASS（包括 Task 1 的新测试）。

- [ ] **Step 3：提交**

```bash
git add material-rag.js tests/material-rag.test.js
git commit -m "fix: derive sectionNo from heading path only, not content"
```

---

## Task 3：为查询归一化添加失败测试

**Files:**
- Modify: `tests/material-rag.test.js`

- [ ] **Step 1：追加以下三个测试**

```js
// ── 新增测试：改动 2 ──────────────────────────────────────────────────────

test('extractQueryHints normalizes 第X章第Y节 (Chinese numerals) to X.Y', () => {
  const h1 = extractQueryHints('第三章第四节第3题');
  assert.equal(h1.sectionNo, '3.4', '第三章第四节 → 3.4');
  assert.equal(h1.itemNo, '3');

  const h2 = extractQueryHints('第3章第4节');
  assert.equal(h2.sectionNo, '3.4', '第3章第4节 → 3.4');
});

test('extractQueryHints normalizes "chapter X section Y" to X.Y', () => {
  const h = extractQueryHints('chapter 3 section 4 problem 3');
  assert.equal(h.sectionNo, '3.4');
  assert.equal(h.itemNo, '3');
});

test('extractQueryHints does not extract sectionNo from formula/figure references', () => {
  assert.equal(extractQueryHints('公式(3.4)是什么意思').sectionNo, '', '公式(3.4) should not become sectionNo');
  assert.equal(extractQueryHints('图3.4说明了什么').sectionNo,    '', '图3.4 should not become sectionNo');
  assert.equal(extractQueryHints('equation (3.4) derivation').sectionNo, '', 'equation (3.4) should not become sectionNo');
  assert.equal(extractQueryHints('figure 3.4 shows the curve').sectionNo, '', 'figure 3.4 should not become sectionNo');
  // 真正的章节写法仍然有效
  assert.equal(extractQueryHints('3.4节第3题').sectionNo, '3.4', '3.4节 still works');
  assert.equal(extractQueryHints('Section 3.4 problem 3').sectionNo, '3.4', 'Section 3.4 still works');
});
```

- [ ] **Step 2：运行测试，确认三个新测试失败**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：三个新测试 FAIL，其余 PASS。

---

## Task 4：实现 extractQueryHints 查询归一化

**Files:**
- Modify: `material-rag.js`

- [ ] **Step 1：在 `extractQueryHints` 函数之前插入 `toArabic` 辅助函数**

找到 `function extractQueryHints(query) {` 这一行，在它**之前**插入：

```js
  const ZH_DIGIT = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

  function toArabic(str) {
    const n = parseInt(str, 10);
    if (!isNaN(n)) return String(n);
    if (ZH_DIGIT[str] !== undefined) return String(ZH_DIGIT[str]);
    // 十X → 10+X
    if (str.startsWith('十') && ZH_DIGIT[str[1]] !== undefined) return String(10 + ZH_DIGIT[str[1]]);
    // X十 → X*10
    if (str.length === 2 && str[1] === '十' && ZH_DIGIT[str[0]] !== undefined) return String(ZH_DIGIT[str[0]] * 10);
    // X十Y → X*10+Y
    if (str.length === 3 && str[1] === '十' && ZH_DIGIT[str[0]] !== undefined && ZH_DIGIT[str[2]] !== undefined)
      return String(ZH_DIGIT[str[0]] * 10 + ZH_DIGIT[str[2]]);
    return str;
  }
```

- [ ] **Step 2：替换 `extractQueryHints` 函数体**

将现有函数：
```js
  function extractQueryHints(query) {
    const q = normalizeSpaces(query);
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
```

替换为：
```js
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
```

注意：`FORMULA_REF_RE`、`ZH_CHAPTER_SECTION_RE`、`EN_CHAPTER_SECTION_RE` 三个常量声明在函数外（模块级别），与其他 `const ... = /regex/` 常量保持同一位置风格。

- [ ] **Step 3：运行测试，确认所有测试通过**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：全部 PASS。

- [ ] **Step 4：提交**

```bash
git add material-rag.js tests/material-rag.test.js
git commit -m "fix: normalize query section forms and strip formula/figure refs"
```

---

## Task 5：为 buildTargetedExcerpt 标题优先添加失败测试

**Files:**
- Modify: `tests/material-rag.test.js`

- [ ] **Step 1：追加以下测试**

```js
// ── 新增测试：改动 3 ──────────────────────────────────────────────────────

const equationPollutionMarkdown = `# Chapter 2

## Mixing Problems

The cooling equation is (3.4): dT/dt = k(T - M).

${'filler content '.repeat(1500)}

# Chapter 3

## 3.4 Real Repeated Roots

### Exercises

3. Solve y'' + 2y' + y = 0.
Show that the general solution is y = (c1 + c2*t)*e^(-t).
`;

test('buildTargetedExcerpt anchors on heading occurrences, not equation refs in earlier chapters', () => {
  const excerpt = buildTargetedExcerpt(equationPollutionMarkdown, '3.4节第3题', {
    maxChars: 8000,
    beforeChars: 500,
  });
  assert.match(excerpt.text, /Real Repeated Roots/, 'should land in Section 3.4 heading area');
  assert.match(excerpt.text, /general solution/, 'should include exercise 3 content');
  assert.doesNotMatch(excerpt.text, /dT\/dt = k/, 'should not return Chapter 2 equation content');
});
```

- [ ] **Step 2：运行测试，确认新测试失败**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：新测试 FAIL（excerpt 落在 Chapter 2 的 equation），其余 PASS。

---

## Task 6：实现 buildTargetedExcerpt — 非标题行降权

**Files:**
- Modify: `material-rag.js`

- [ ] **Step 1：找到 `buildTargetedExcerpt` 内处理 `hints.sectionNo` 的循环，替换评分逻辑**

定位（约第 265-280 行）：
```js
    if (hints.sectionNo) {
      const sectionRe = new RegExp(escapeRegExp(hints.sectionNo), 'g');
      for (const pos of collectRegexPositions(source, sectionRe)) {
        const line = lineAround(source, pos);
        addCandidate(pos, /^#{1,6}\s+/.test(line) ? 120 : 70, 'section');
        if (isLikelyTocLine(line)) {
```

替换为：
```js
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
```

（`if (isLikelyTocLine(line)) {` 之后的代码保持不变。）

- [ ] **Step 2：运行所有测试，确认全部通过**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：全部 PASS（包括 Task 5 的新测试）。

- [ ] **Step 3：提交**

```bash
git add material-rag.js tests/material-rag.test.js
git commit -m "fix: downweight equation/figure refs in buildTargetedExcerpt anchor scoring"
```

---

## Task 7：版本号递增与 STATUS.md 更新

**Files:**
- Modify: `material-rag.js:6`
- Modify: `course.html:611`
- Modify: `STATUS.md`

- [ ] **Step 1：递增 `INDEX_VERSION`**

`material-rag.js` 第 6 行：
```js
const INDEX_VERSION = 46;   // 改前是 44
```

- [ ] **Step 2：递增 `course.html` 版本号**

`course.html` 第 611 行：
```html
<script src="material-rag.js?v=46"></script>   <!-- 改前是 v=45 -->
```

- [ ] **Step 3：更新 STATUS.md**

将 `STATUS.md` 顶部版本区域改为：
```
**当前版本**: `course.js?v=44` / `material-rag.js?v=46`
**部署状态**: ⏳ v46 本地完成，待推送后由 Vercel 部署
```

将 `近期变更` 区域改为：
```
本次工作  fix: rag section retrieval — heading-only sectionNo, query normalization, anchor downweight
93aab2b  fix: switch claude default model to sonnet-4-6
77f2fdb  fix: trigger targeted excerpt on section+item mismatch
c823ee9  fix: supplement low-confidence rag matches
```

将 TASKS 表中 P10 行改为：
```
| P10 | RAG 结构化索引与习题级召回 | ✅ 已验收 | v=46 | sectionNo 仅从标题路径提取；查询归一化多形式章节写法；全文搜索公式/图编号降权 |
```

- [ ] **Step 4：运行所有测试最后确认**

```bash
node --test tests/material-rag.test.js 2>&1 | tail -30
```

预期：全部 PASS。

- [ ] **Step 5：提交并推送**

```bash
git add material-rag.js course.html STATUS.md
git commit -m "fix: bump INDEX_VERSION to 46, force chunk re-index after rag fixes"
git push origin main
```
