# Provider-Aware Material Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat chunk-based RAG with a provider-aware strategy: Gemini receives the full Markdown document (up to 800K chars), other providers receive the exact section the user asked about (e.g., all of §3.4), with chunk-based RAG as fallback when no section is detected.

**Architecture:** Add `extractSectionFromMarkdown(markdown, sectionNo)` to `material-rag.js` for slicing a section from raw Markdown. Update `loadRetrievedMaterialContext` in `course.js` to branch on `aiProvider`: Gemini → concatenate full files; others → call section extractor if `sectionNo` detected, else fall back to existing chunk RAG. The chunk index is still built for non-Gemini non-section fallback.

**Tech Stack:** Pure browser Vanilla JS, IndexedDB (existing), no new CDN libraries.

---

## File Map

| File | Change |
|---|---|
| `material-rag.js` | Add `extractSectionFromMarkdown`, export it, bump `INDEX_VERSION` → 47 |
| `course.js` | Add `loadFullDocumentContext`, `loadSectionContext`; update `loadRetrievedMaterialContext(query, provider)`; pass `aiProvider` in `doSend()` |
| `course.html` | Update `material-rag.js?v=47`, `course.js?v=45` |
| `index.html` | Update `.app-version` to `v47` |
| `STATUS.md` | Update version record |
| `tests/material-rag.test.js` | Add tests for `extractSectionFromMarkdown` |

---

### Task 1: Add `extractSectionFromMarkdown` to `material-rag.js`

**Files:**
- Modify: `material-rag.js` (add function, update exports, bump INDEX_VERSION)
- Test: `tests/material-rag.test.js`

The function scans Markdown line by line, finds the heading whose text contains the given `sectionNo`, then collects content until the next heading of equal or higher level.

- [ ] **Step 1: Write failing tests**

Add these tests at the bottom of `tests/material-rag.test.js`:

```js
// ── extractSectionFromMarkdown tests ────────────────────────────────────────

const multiSectionMd = `# Chapter 3

## 3.3 Introduction

Intro content.

## 3.4 Real Repeated Roots

This section explains repeated roots.

### 3.4.1 Method

The characteristic equation approach.

### Exercises

1. Solve y'' + 2y' + y = 0.

2. Solve y'' + 4y' + 4y = 0.

3. Show the general solution form.

## 3.5 Next Section

Unrelated content.
`;

test('extractSectionFromMarkdown returns content from matching heading to next same-level heading', () => {
  const section = extractSectionFromMarkdown(multiSectionMd, '3.4');
  assert.match(section, /Real Repeated Roots/);
  assert.match(section, /repeated roots/);
  assert.match(section, /characteristic equation/);
  assert.match(section, /3\.4\.1/);
  assert.match(section, /Solve y'' \+ 4y'/);
  assert.doesNotMatch(section, /Unrelated content/);
  assert.doesNotMatch(section, /Intro content/);
});

test('extractSectionFromMarkdown returns empty string when section not found', () => {
  const section = extractSectionFromMarkdown(multiSectionMd, '9.9');
  assert.equal(section, '');
});

test('extractSectionFromMarkdown includes sub-headings within the section', () => {
  const section = extractSectionFromMarkdown(multiSectionMd, '3.4');
  assert.match(section, /### 3\.4\.1 Method/);
  assert.match(section, /### Exercises/);
});

test('extractSectionFromMarkdown handles single-entry markdown with no following heading', () => {
  const md = `# Chapter 1\n\n## 1.1 Only Section\n\nOnly content here.\n`;
  const section = extractSectionFromMarkdown(md, '1.1');
  assert.match(section, /Only Section/);
  assert.match(section, /Only content here/);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/dan_cog/Desktop/softwaredevelop/exam-tracker
node --test tests/material-rag.test.js 2>&1 | tail -20
```

Expected: 4 new tests fail with `extractSectionFromMarkdown is not a function` (or similar destructuring error).

- [ ] **Step 3: Implement `extractSectionFromMarkdown` in `material-rag.js`**

In `material-rag.js`, add this function after the `buildTargetedExcerpt` function (before `scoreChunk`):

```js
function extractSectionFromMarkdown(markdown, sectionNo) {
  if (!sectionNo) return '';
  const lines = String(markdown || '').split('\n');
  let foundLevel = -1;
  let collecting = false;
  const result = [];

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (collecting) {
        if (level <= foundLevel) break;
        result.push(line);
      } else if (detectSection(headingMatch[2]) === sectionNo) {
        foundLevel = level;
        collecting = true;
        result.push(line);
      }
    } else if (collecting) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}
```

- [ ] **Step 4: Export `extractSectionFromMarkdown` in the return object**

In `material-rag.js`, find the `return {` block at the bottom and add `extractSectionFromMarkdown`:

```js
  return {
    INDEX_VERSION,
    chunkMarkdownMaterial,
    extractQueryHints,
    extractSectionFromMarkdown,
    buildTargetedExcerpt,
    needsTargetedExcerpt,
    rankMaterialChunks,
    formatRetrievedContext,
  };
```

- [ ] **Step 5: Bump INDEX_VERSION to 47**

In `material-rag.js` line 6, change:

```js
  const INDEX_VERSION = 46;
```

to:

```js
  const INDEX_VERSION = 47;
```

- [ ] **Step 6: Run all tests to confirm they pass**

```bash
cd /Users/dan_cog/Desktop/softwaredevelop/exam-tracker
node --test tests/material-rag.test.js 2>&1 | tail -10
```

Expected output: `pass 18` (14 existing + 4 new), `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add material-rag.js tests/material-rag.test.js
git commit -m "feat: add extractSectionFromMarkdown to material-rag.js (v47)"
```

---

### Task 2: Update `course.js` with provider-aware context loading

**Files:**
- Modify: `course.js` (add helpers, update `loadRetrievedMaterialContext`, update `doSend`)

- [ ] **Step 1: Add `loadFullDocumentContext` helper function**

In `course.js`, add this new function immediately after the existing `loadRetrievedMaterialContext` function (around line 2215):

```js
async function loadFullDocumentContext(selectedMdFiles) {
  const TOTAL_CAP = 800000;
  let total = 0;
  const bodies = [];
  for (const f of selectedMdFiles) {
    if (total >= TOTAL_CAP) break;
    const text = new TextDecoder().decode(f.data || new ArrayBuffer(0));
    const slice = text.slice(0, TOTAL_CAP - total);
    bodies.push(`--- 文件：${f.name} ---\n${slice}`);
    total += slice.length;
  }
  if (!bodies.length) return '';
  const label = total >= TOTAL_CAP ? `（共 ${TOTAL_CAP} 字符，已截断）` : '';
  return `完整课程资料${label}：\n${bodies.join('\n\n')}`;
}
```

- [ ] **Step 2: Add `loadSectionContext` helper function**

Add this function right after `loadFullDocumentContext`:

```js
async function loadSectionContext(query, selectedMdFiles) {
  if (!window.MaterialRAG || !MaterialRAG.extractSectionFromMarkdown) return '';
  const hints = MaterialRAG.extractQueryHints(query);
  if (!hints.sectionNo) return '';
  const bodies = [];
  for (const f of selectedMdFiles) {
    const text = new TextDecoder().decode(f.data || new ArrayBuffer(0));
    const section = MaterialRAG.extractSectionFromMarkdown(text, hints.sectionNo);
    if (section) {
      bodies.push(`--- 文件：${f.name}  § ${hints.sectionNo} ---\n${section}`);
    }
  }
  if (!bodies.length) return '';
  return `课程资料 § ${hints.sectionNo}（完整章节内容）：\n${bodies.join('\n\n')}`;
}
```

- [ ] **Step 3: Replace `loadRetrievedMaterialContext` with provider-aware version**

Find the existing `loadRetrievedMaterialContext` function (around line 2192) and replace it entirely:

```js
async function loadRetrievedMaterialContext(query, provider) {
  if (!window.MaterialRAG) return '';
  try {
    const all = await dbGetAll();
    const selectedMdFiles = all
      .filter(f => f.courseId === courseId && (f.name || '').toLowerCase().endsWith('.md'))
      .filter(f => selectedFiles.size === 0 || selectedFiles.has(f.id));
    if (!selectedMdFiles.length) return '';

    if (provider === 'gemini') {
      return await loadFullDocumentContext(selectedMdFiles);
    }

    // Non-Gemini: try section-level extraction first
    const sectionCtx = await loadSectionContext(query, selectedMdFiles);
    if (sectionCtx) return sectionCtx;

    // Fallback: chunk-based RAG
    await Promise.all(selectedMdFiles.map(f => ensureChunksForMaterial(f)));
    const selectedMdIds = new Set(selectedMdFiles.map(f => f.id));
    const chunks = (await dbGetChunksForCourse(courseId))
      .filter(c => selectedMdIds.has(c.fileId));
    const matches = MaterialRAG.rankMaterialChunks(query, chunks, 6);
    const retrievedContext = MaterialRAG.formatRetrievedContext(matches);
    const targetedContext = MaterialRAG.needsTargetedExcerpt(query, matches)
      ? await buildTargetedMaterialExcerptContext(query, selectedMdFiles, 'RAG 题号补充摘录')
      : '';
    return [retrievedContext, targetedContext].filter(Boolean).join('\n\n');
  } catch (e) {
    console.warn('[ExamTracker] material retrieval failed', e);
    return '';
  }
}
```

- [ ] **Step 4: Update `doSend()` to pass `aiProvider`**

Find this line in `doSend()` (around line 2611):

```js
  const mdCtx = await loadRetrievedMaterialContext(text);
```

Change it to:

```js
  const mdCtx = await loadRetrievedMaterialContext(text, aiProvider);
```

- [ ] **Step 5: Commit**

```bash
git add course.js
git commit -m "feat: provider-aware material context — Gemini full doc, others section-level"
```

---

### Task 3: Version bump and metadata update

**Files:**
- Modify: `course.html`, `index.html`, `STATUS.md`

- [ ] **Step 1: Update `course.html` version query strings**

In `course.html`, find:
```html
<script src="material-rag.js?v=46"></script>
```
Change to:
```html
<script src="material-rag.js?v=47"></script>
```

Find:
```html
<script src="course.js?v=44"></script>
```
Change to:
```html
<script src="course.js?v=45"></script>
```

- [ ] **Step 2: Update `index.html` app version label**

In `index.html` line 18, find:
```html
<span class="app-version" aria-label="Build version">v46</span>
```
Change to:
```html
<span class="app-version" aria-label="Build version">v47</span>
```

- [ ] **Step 3: Update `STATUS.md`**

In `STATUS.md`, find the version line at the top:
```
**当前版本**: `course.js?v=44` / `material-rag.js?v=46`
```
Change to:
```
**当前版本**: `course.js?v=45` / `material-rag.js?v=47`
```

Add to the TASKS table a new completed row for this feature, and update the `近期变更` section.

- [ ] **Step 4: Commit version bump**

```bash
git add course.html index.html STATUS.md
git commit -m "chore: bump to course.js?v=45 / material-rag.js?v=47 — provider-aware context"
```

- [ ] **Step 5: Push to trigger Vercel deploy**

```bash
git push origin main
```

Verify `index.html` shows `v47` on the live site after deploy.
