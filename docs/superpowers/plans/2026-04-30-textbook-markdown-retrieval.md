# Textbook Markdown Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local textbook-aware Markdown retrieval so AI questions cite only relevant course material snippets instead of full files.

**Architecture:** Extract pure chunking/retrieval logic into `material-rag.js`, load it before `course.js`, persist generated chunks in IndexedDB, and call retrieval for every free-form AI message. Keep existing conversation storage lean by injecting retrieved snippets only into the current API payload.

**Tech Stack:** Browser JavaScript, IndexedDB, Node `node:test` for pure logic and static regression tests.

---

## File Map

| File | Change |
|---|---|
| `material-rag.js` | New pure helper: Markdown chunking, query hint extraction, chunk ranking, prompt context formatting |
| `course.html` | Load `material-rag.js` before `course.js`; bump `course.js?v=35` |
| `course.js` | Add `materialChunks` store, chunk persistence helpers, chunk generation/deletion, retrieval in `doSend` |
| `tests/material-rag.test.js` | New behavior tests for chunking and retrieval |
| `tests/p6-p8-regression.test.js` | Static wiring tests |
| `STATUS.md`, `ROADMAP.md`, `SESSION_LOG.md`, `.agents/AGENT_GUIDELINES.md` | Status/version/docs sync after implementation |

## Task 1: Pure Chunking and Retrieval Helper

**Files:**
- Create: `material-rag.js`
- Create: `tests/material-rag.test.js`

- [ ] Write failing tests in `tests/material-rag.test.js` that import `material-rag.js` with Node and verify:
  - heading paths are preserved
  - section number `3.4` is detected
  - exercise/problem number `3` is detected
  - a query for `3.4 第 3 题` ranks that chunk first
  - formatted context includes file name and heading path

- [ ] Implement `window.MaterialRAG` plus CommonJS export with these functions:
  - `chunkMarkdownMaterial({ fileId, courseId, fileName, text, maxChars = 4000, overlap = 400 })`
  - `extractQueryHints(query)`
  - `rankMaterialChunks(query, chunks, limit = 6)`
  - `formatRetrievedContext(matches)`

- [ ] Run `node --test tests/material-rag.test.js` and verify pass.

- [ ] Commit: `feat: add textbook markdown chunking helper`

## Task 2: IndexedDB Chunk Store and Material Lifecycle

**Files:**
- Modify: `course.js`
- Modify: `tests/p6-p8-regression.test.js`

- [ ] Write failing static tests asserting:
  - `createObjectStore('materialChunks'` exists
  - `dbSaveChunksForFile(fileId, chunks)` exists
  - `dbGetChunksForCourse(cid)` exists
  - `dbDeleteChunksForFile(fileId)` exists
  - `ensureChunksForMaterial(` exists
  - material delete calls `dbDeleteChunksForFile(f.id)`

- [ ] Update `getDB()` upgrade handler to create `materialChunks` when missing. Because `examTrackerFiles` currently opens without a version, use a guarded reopen path: if store missing, close and reopen version `db.version + 1` with `onupgradeneeded` creating only missing stores.

- [ ] Add chunk persistence helpers after file DB helpers.

- [ ] Generate chunks when saving Markdown materials in `saveMdAsMaterial()` and when rendering existing Markdown materials that do not have chunks yet.

- [ ] Delete chunks when deleting a material.

- [ ] Run regression tests.

- [ ] Commit: `feat: persist markdown retrieval chunks`

## Task 3: AI Retrieval Path

**Files:**
- Modify: `course.js`
- Modify: `course.html`
- Modify: `tests/p6-p8-regression.test.js`

- [ ] Write failing static tests asserting:
  - `material-rag.js` is loaded before `course.js`
  - `async function loadRetrievedMaterialContext(query)` exists
  - `doSend()` calls `loadRetrievedMaterialContext(text)`
  - `doSend()` does not gate material context on `aiConversation.length === 0`
  - `course.html` uses `course.js?v=35`

- [ ] Add `loadRetrievedMaterialContext(query)`:
  - get chunks for current course
  - filter to selected Markdown files when `selectedFiles` is non-empty
  - rank chunks with `MaterialRAG.rankMaterialChunks`
  - format with `MaterialRAG.formatRetrievedContext`

- [ ] Update `doSend()` to include retrieved snippets on every turn in the API-only payload.

- [ ] Keep `sendAIMsg()` unchanged so stored history remains lean.

- [ ] Run regression tests and syntax checks.

- [ ] Commit: `feat: retrieve relevant course material snippets for AI chat`

## Task 4: Status Sync and Final Verification

**Files:**
- Modify: `STATUS.md`
- Modify: `ROADMAP.md`
- Modify: `.agents/AGENT_GUIDELINES.md`
- Modify: `SESSION_LOG.md`

- [ ] Update current version to `v=35`.
- [ ] Add current capability: textbook Markdown chunk retrieval.
- [ ] Add known limitation: first version uses deterministic local retrieval, no embeddings.
- [ ] Run:
  - `node --test tests/material-rag.test.js`
  - `node --test tests/p6-p8-regression.test.js`
  - `node --check material-rag.js`
  - `node --check course.js`
  - `git diff --check`

- [ ] Commit: `docs: sync status for material retrieval v35`
