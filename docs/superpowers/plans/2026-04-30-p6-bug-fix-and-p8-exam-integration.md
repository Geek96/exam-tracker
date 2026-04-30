# P6 Bug Fix & P8 Exam Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Root-cause fix the AI chat data corruption bug — large markdown context was being stored in `aiConversation` and sent to the API on every turn, plus all `localStorage.setItem` calls lacked error handling. (2) Integrate the exam management module into the course page, filtered by `courseId`.

**Architecture:**
- Task 1 (P6): Separate "API payload content" from "conversation display content" so `aiConversation` only ever stores short display-ready text. Build a separate `apiMsgs` array in `sendAIMsg` that injects full context for the current turn. Add `try/catch` to every `localStorage.setItem` call and cap sessions at 5.
- Task 2 (P8): Add a course-specific exam panel card to `course.html`, reusing `EXAMS_KEY` storage from `app.js`. Exams created from the course page carry `courseId`; the panel filters by it. The global index page continues to show all exams.

**Tech Stack:** Vanilla JS, HTML, CSS — no build step. `strings.js` i18n. `localStorage` for course/exam data. `course.js?v=N` cache-busting.

---

## File Map

| File | Change |
|---|---|
| `course.js` | Refactor `sendAIMsg`, `doSend`, `handleQuickAction`; add try-catch to storage writes; add exam panel logic; version bump |
| `course.html` | Add exam nav card HTML, exam panel HTML, exam modal HTML; version bump on `<script>` tag |
| `course.css` | Add exam panel/card/item styles |
| `strings.js` | Add `examCount` key (zh/en/es) |
| `app.js` | Add try-catch to `saveCourses` and `saveExams` |

---

## Task 1 — P6: Separate API content from conversation storage

**Files:**
- Modify: `course.js` (lines ~1682–2240 — AI chat section)

### Why the bug happens

`doSend` and `handleQuickAction` build a large `userContent` string (user text + up to 300 KB of markdown context) and call `sendAIMsg(userContent, displayLabel)`. Inside `sendAIMsg`, the large `userContent` is pushed into `aiConversation[x].content`. On every subsequent API call, ALL of `aiConversation` (including the 300 KB content) is serialised and sent. This also means that if `sessPersist` ever writes a session before the display-field truncation is applied, or if any other code path reads `m.content` expecting a short string, large data propagates.

The fix: `sendAIMsg` accepts an optional `apiContent` parameter. `aiConversation` always stores only the short display text. When building the API request, the last user message in the payload is replaced with `apiContent` (which may include the markdown context).

- [ ] **Step 1: Refactor `sendAIMsg` signature and API payload**

Replace the existing `sendAIMsg` function (lines ~2119–2222) with this version:

```js
// ── Core: send one message and stream the response ────────────────────────────
async function sendAIMsg(userText, displayLabel, apiContent) {
  if (aiStreaming) return;
  aiStreaming = true;

  const welcome = document.getElementById('aiWelcomeState');
  if (welcome) welcome.style.display = 'none';

  aiChatInput.disabled = true;
  document.getElementById('aiChatSend').disabled = true;

  // Store ONLY the short display text in conversation (never the full context blob)
  aiConversation.push({ role: 'user', content: userText, display: displayLabel || userText });
  sessPersist();

  const userEl = document.createElement('div');
  userEl.className = 'chat-msg chat-msg-user';
  userEl.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHtml(displayLabel || userText)}</div>`;
  aiChatMessages.appendChild(userEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  const aiMsgEl = document.createElement('div');
  aiMsgEl.className = 'chat-msg chat-msg-assistant';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-ai';
  bubble.innerHTML = '<div class="ai-generating"><span class="ai-spinner"></span>正在生成…</div>';
  aiMsgEl.appendChild(bubble);
  aiChatMessages.appendChild(aiMsgEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  aiAbortCtrl = new AbortController();
  let fullText = '';

  try {
    // Build API payload: use full apiContent only for the current (last) user message.
    // All prior messages use their stored content (short display text).
    const apiMsgs = aiConversation.map((m, i) => {
      if (i === aiConversation.length - 1 && apiContent) {
        return { role: 'user', content: apiContent };
      }
      return { role: m.role, content: m.content };
    });

    const res = await fetch('/api/study-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: aiAbortCtrl.signal,
      body: JSON.stringify({
        provider:   aiProvider,
        courseName: course.name,
        subject:    course.subject,
        messages:   apiMsgs,
        lang:       localStorage.getItem('app_lang') || 'zh',
      }),
    });

    if (!res.ok) {
      let errMsg;
      try { errMsg = (await res.json()).error; } catch { errMsg = await res.text(); }
      bubble.innerHTML = `<div class="ai-error">生成失败（${res.status}）：${escHtml(errMsg || '')}</div>`;
      aiConversation.pop();
      return;
    }

    bubble.innerHTML = '';
    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let buf      = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.err) throw new Error(ev.err);
          if (ev.t) {
            fullText += ev.t;
            bubble.innerHTML = mdToHtml(fullText) + '<span class="ai-cursor"></span>';
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
          }
        } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
      }
    }

    bubble.innerHTML = mdToHtml(fullText);
    renderMath(bubble);
    aiConversation.push({ role: 'assistant', content: fullText });
    sessPersist();

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save-msg';
    saveBtn.textContent = '💾 保存为资料';
    saveBtn.addEventListener('click', () => saveMsgAsMaterial(fullText));
    aiMsgEl.appendChild(saveBtn);

  } catch (err) {
    if (err.name === 'AbortError') { aiConversation.pop(); return; }
    bubble.innerHTML = `<div class="ai-error">网络错误：${escHtml(err.message)}</div>`;
    aiConversation.pop();
  } finally {
    aiStreaming = false;
    aiAbortCtrl = null;
    aiChatInput.disabled = false;
    document.getElementById('aiChatSend').disabled = false;
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }
}
```

- [ ] **Step 2: Refactor `doSend` to pass `apiContent` separately**

Replace the existing `doSend` function (lines ~2225–2238):

```js
async function doSend() {
  const text = aiChatInput.value.trim();
  if (!text || aiStreaming) return;
  aiChatInput.value = '';
  autoResizeInput();

  // On the first turn only, prepend markdown context to the API payload.
  // Never store the context in aiConversation — only the user's visible text.
  let apiContent = text;
  if (aiConversation.length === 0) {
    const mdCtx = await loadMarkdownContext();
    if (mdCtx) apiContent = text + '\n\n[课程资料]\n' + mdCtx;
  }
  await sendAIMsg(text, text, apiContent);
}
```

- [ ] **Step 3: Refactor `handleQuickAction` to pass `apiContent` separately**

Replace the existing `handleQuickAction` function (lines ~1971–1989):

```js
async function handleQuickAction(type) {
  const daysLeft    = parseFloat(aiDaysLeft.value)    || 7;
  const hoursPerDay = parseFloat(aiHoursPerDay.value) || 3;
  const mdCtx = await loadMarkdownContext();

  let apiContent, displayLabel;
  if (type === 'plan') {
    const guide = getActiveGuide();
    apiContent = buildContextMsg(daysLeft, hoursPerDay, guide, mdCtx);
    displayLabel = `📋 生成复习计划 · ${daysLeft} 天 · 每天 ${hoursPerDay} 小时`;
  } else if (type === 'summary') {
    apiContent = `请帮我总结课程「${escHtml(course.name)}」的核心知识点和重点内容。${mdCtx ? '\n\n课程资料：\n' + mdCtx : ''}`;
    displayLabel = '📖 总结课程重点';
  } else {
    apiContent = `请根据课程「${escHtml(course.name)}」的内容为我出几道测验题，并给出答案。${mdCtx ? '\n\n课程资料：\n' + mdCtx : ''}`;
    displayLabel = '❓ 出题测验';
  }
  // userText = displayLabel (short button label); apiContent carries full context
  await sendAIMsg(displayLabel, displayLabel, apiContent);
}
```

- [ ] **Step 4: Commit Task 1**

```bash
git add course.js
git commit -m "fix(P6): separate API context from aiConversation storage

aiConversation now stores only short display text. sendAIMsg builds
a separate apiMsgs array for API calls, injecting full markdown context
only on the current turn's payload. Prevents 300 KB+ content from
accumulating in memory and being resent on every subsequent turn."
```

---

## Task 2 — P6: Harden all localStorage writes

**Files:**
- Modify: `course.js` (storage functions)
- Modify: `app.js` (storage functions)

If `localStorage` is full (QuotaExceededError), any unguarded `localStorage.setItem` call propagates as an unhandled exception. `saveCourses()` → `persist()` is called during `renderProgress()` which is part of page initialisation. A crash there leaves the page partially rendered and all subsequent DOM/event code skipped.

- [ ] **Step 1: Add try-catch to `saveCourses` in `course.js`**

Find this function at line ~18:
```js
function saveCourses(courses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}
```

Replace with:
```js
function saveCourses(courses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch (e) {
    console.warn('[ExamTracker] saveCourses failed (quota?)', e);
  }
}
```

- [ ] **Step 2: Add try-catch to `saveFileSelection` in `course.js`**

Find this function at line ~1479:
```js
function saveFileSelection(sel) {
  localStorage.setItem('aiFileSelection_' + courseId, JSON.stringify([...sel]));
}
```

Replace with:
```js
function saveFileSelection(sel) {
  try {
    localStorage.setItem('aiFileSelection_' + courseId, JSON.stringify([...sel]));
  } catch {}
}
```

- [ ] **Step 3: Add try-catch to `saveCourses` and `saveExams` in `app.js`**

In `app.js` at line ~30, find:
```js
function saveCourses(courses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}
```
Replace with:
```js
function saveCourses(courses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch (e) {
    console.warn('[ExamTracker] saveCourses failed (quota?)', e);
  }
}
```

In `app.js` at line ~275, find:
```js
function saveExams(exams) {
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
}
```
Replace with:
```js
function saveExams(exams) {
  try {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  } catch (e) {
    console.warn('[ExamTracker] saveExams failed (quota?)', e);
  }
}
```

- [ ] **Step 4: Cap sessions at 5 in `sessCreate`**

Find `sessCreate` at line ~1724:
```js
function sessCreate(hint) {
  const sessions = sessLoad();
  const id = 'sess_' + Date.now();
  const title = hint ? hint.slice(0, 32) + (hint.length > 32 ? '…' : '') : '新对话';
  sessions.unshift({ id, title, createdAt: Date.now(), messages: [] });
  sessSave(sessions);
  actSet(id);
  return id;
}
```

Replace with:
```js
function sessCreate(hint) {
  let sessions = sessLoad();
  const id = 'sess_' + Date.now();
  const title = hint ? hint.slice(0, 32) + (hint.length > 32 ? '…' : '') : '新对话';
  sessions.unshift({ id, title, createdAt: Date.now(), messages: [] });
  if (sessions.length > 5) sessions = sessions.slice(0, 5);
  sessSave(sessions);
  actSet(id);
  return id;
}
```

- [ ] **Step 5: Commit Task 2**

```bash
git add course.js app.js
git commit -m "fix(P6): harden localStorage writes and cap session history

All localStorage.setItem calls are now wrapped in try/catch to prevent
QuotaExceededError from crashing page initialisation. Session history is
capped at 5 entries to prevent unbounded growth."
```

---

## Task 3 — P8: Add i18n key and bump version

**Files:**
- Modify: `strings.js`
- Modify: `course.html` (version bump v29 → v30)

- [ ] **Step 1: Add `examCount` i18n key to `strings.js`**

Find the `zh` block in `strings.js` (around line 114 near the exam keys) and add `examCount`:
```js
examCount: '{n} 场考试',
```

Find the `en` block (around line 235) and add:
```js
examCount: '{n} exam(s)',
```

Find the `es` block (around line 356) and add:
```js
examCount: '{n} examen(es)',
```

- [ ] **Step 2: Bump course.js version in `course.html`**

Find the bottom of `course.html`:
```html
<script src="course.js?v=29"></script>
```
Change to:
```html
<script src="course.js?v=30"></script>
```

Also update `AGENT_GUIDELINES.md` line `当前版本：v=29` → `v=30`.

- [ ] **Step 3: Commit**

```bash
git add strings.js course.html .agents/AGENT_GUIDELINES.md
git commit -m "chore: add examCount i18n key and bump course.js to v30"
```

---

## Task 4 — P8: Add exam panel HTML to `course.html`

**Files:**
- Modify: `course.html`

The exam panel follows the same pattern as the chapters panel (State A → State B navigation). We add:
1. An exam nav card in `panelOverview` (below the chapter card)
2. A new State C: `panelExams` div (shown when user clicks the exam card)
3. An exam modal (add exam form) — reuse the same structure as the one in `index.html`

- [ ] **Step 1: Add exam nav card inside `panelOverview`**

In `course.html`, find the chapter nav card block and insert AFTER it (after the closing `</div>` of `chapterNavCard`, before `importLandingInline`):

```html
        <!-- Exam navigation card -->
        <div class="chapter-nav-card holo-card-border exam-nav-card" id="examNavCard" style="cursor:pointer">
          <div class="chapter-nav-surface holo-card-surface">
            <div class="chapter-nav-icon">📅</div>
            <div class="chapter-nav-info">
              <div class="chapter-nav-title" data-i18n="myExams">我的考试</div>
              <div class="chapter-nav-meta" id="examNavMeta"></div>
            </div>
            <div class="chapter-nav-right">
              <span class="chapter-nav-arrow">›</span>
            </div>
          </div>
        </div>
```

- [ ] **Step 2: Add exam panel (State C) inside `panel-left`**

In `course.html`, find the closing `</div><!-- /panel-left -->` tag and insert a new panel BEFORE it:

```html
      <!-- ── State C: Exams panel ── -->
      <div id="panelExams" style="display:none; height:100%; flex-direction:column;">

        <div class="chapters-panel-header">
          <button class="chapters-back-btn" id="btnExamsBack" data-i18n="backBtn">← 返回</button>
          <h3 class="chapters-panel-title" data-i18n="myExams">我的考试</h3>
          <button class="btn-sm accent" id="btnAddExamCourse" data-i18n="addExam">+ 添加考试</button>
        </div>

        <div class="exam-panel-body" id="examPanelBody">
          <div class="exam-panel-empty" id="examPanelEmpty" style="display:none">
            <div class="materials-empty-icon">📅</div>
            <p data-i18n="noExamsTitle">暂无考试安排</p>
            <p class="empty-sub" data-i18n="noExamsHint">点击「添加考试」新增一场考试</p>
          </div>
          <div class="exam-panel-list" id="examPanelList"></div>
        </div>

      </div>
```

- [ ] **Step 3: Add exam modal for course page**

In `course.html`, find the first `<div class="modal-overlay"` and insert a NEW exam modal BEFORE it (so it's a sibling, not nested):

```html
  <!-- ── Exam Add Modal (course page) ── -->
  <div class="modal-overlay" id="courseExamModalOverlay">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title" data-i18n="addExamTitle">添加新考试</h3>
        <button class="modal-close" id="courseExamModalClose">✕</button>
      </div>
      <form class="modal-form" id="courseExamForm">
        <label class="form-label"><span data-i18n="examName">考试名称</span> <span class="required">*</span></label>
        <input class="form-input" type="text" id="courseExamInputName"
          data-i18n-ph="examNamePh" placeholder="例：期末数学考试" maxlength="60" required />

        <label class="form-label"><span data-i18n="examDate">考试日期</span> <span class="required">*</span></label>
        <input class="form-input" type="date" id="courseExamInputDate" required />

        <label class="form-label" data-i18n="examType">考试类型</label>
        <div class="exam-type-group" id="courseExamTypeGroup">
          <button type="button" class="exam-type-btn selected" data-type="final" data-i18n="examTypeFinal">期末考</button>
          <button type="button" class="exam-type-btn" data-type="midterm" data-i18n="examTypeMidterm">期中测验</button>
          <button type="button" class="exam-type-btn" data-type="quiz" data-i18n="examTypeQuiz">小测</button>
          <button type="button" class="exam-type-btn" data-type="opening" data-i18n="examTypeOpening">开学测验</button>
          <button type="button" class="exam-type-btn" data-type="credit" data-i18n="examTypeCredit">学分考</button>
          <button type="button" class="exam-type-btn" data-type="other" data-i18n="examTypeOther">其他</button>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" id="courseExamBtnCancel" data-i18n="cancel">取消</button>
          <button type="submit" class="btn-submit" data-i18n="addExam">添加考试</button>
        </div>
      </form>
    </div>
  </div>
```

- [ ] **Step 4: Commit**

```bash
git add course.html
git commit -m "feat(P8): add exam nav card, exam panel, and exam modal HTML to course page"
```

---

## Task 5 — P8: Add exam panel CSS to `course.css`

**Files:**
- Modify: `course.css`

- [ ] **Step 1: Add exam panel styles at the end of `course.css`**

Append to `course.css`:

```css
/* ── Exam Panel ──────────────────────────────────────────────────────────────── */

.exam-nav-card {
  margin-top: 10px;
}

#panelExams {
  display: flex;
}

.exam-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exam-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--muted);
  text-align: center;
  gap: 6px;
}

.exam-panel-empty .materials-empty-icon {
  font-size: 2rem;
  margin-bottom: 6px;
}

.exam-panel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exam-panel-item {
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.exam-panel-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.exam-panel-item-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg, #e0e0f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.exam-panel-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--muted);
  flex-wrap: wrap;
}

.exam-panel-del-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.exam-panel-del-btn:hover {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

/* Reuse exam-type-badge and exam-item-days from index page styles if present,
   otherwise define minimal versions here */
.exam-type-badge {
  padding: 1px 7px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  background: rgba(91,141,239,0.18);
  color: #7ba3f5;
  white-space: nowrap;
}

.exam-item-days {
  font-size: 0.78rem;
  font-weight: 600;
}
.exam-item-days.urgent { color: #ff6b6b; }
.exam-item-days.soon   { color: #ffd86e; }
```

- [ ] **Step 2: Commit**

```bash
git add course.css
git commit -m "feat(P8): add exam panel CSS to course.css"
```

---

## Task 6 — P8: Add exam panel JavaScript to `course.js`

**Files:**
- Modify: `course.js`
- Modify: `course.html` (version bump v30 → v31)

Add the exam management code to `course.js` and update the version.

- [ ] **Step 1: Add exam constants and storage functions**

Find the line `const STORAGE_KEY = 'examTrackerCourses';` near the top of `course.js` (line ~12) and insert AFTER it:

```js
const EXAMS_KEY = 'examTrackerExams';

function loadExams() {
  try { return JSON.parse(localStorage.getItem(EXAMS_KEY)) || []; }
  catch { return []; }
}

function saveExamsLocal(exams) {
  try {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  } catch (e) {
    console.warn('[ExamTracker] saveExams failed (quota?)', e);
  }
}

const EXAM_TYPE_KEYS = {
  opening: 'examTypeOpening',
  midterm: 'examTypeMidterm',
  final:   'examTypeFinal',
  quiz:    'examTypeQuiz',
  credit:  'examTypeCredit',
  other:   'examTypeOther',
};
```

- [ ] **Step 2: Add exam panel logic**

Find the comment `// ── Init ─────────────────────────────────────────` near the bottom of `course.js` (line ~2391) and insert the following block BEFORE it:

```js
// ══════════════════════════════════════════════════════════════════════════════
//  Course Exam Panel
// ══════════════════════════════════════════════════════════════════════════════

let courseExams = loadExams();
let selectedCourseExamType = 'final';

function courseExamDaysBadge(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d < 0)  return `<span class="exam-item-days urgent">${window.t('expired')}</span>`;
  if (d === 0) return `<span class="exam-item-days urgent">${window.t('examToday')}</span>`;
  const label = window.tf('daysLeft', { n: d });
  if (d <= 7)  return `<span class="exam-item-days urgent">${label}</span>`;
  if (d <= 30) return `<span class="exam-item-days soon">${label}</span>`;
  return `<span class="exam-item-days">${label}</span>`;
}

function renderCourseExams() {
  const list  = document.getElementById('examPanelList');
  const empty = document.getElementById('examPanelEmpty');
  if (!list || !empty) return;
  list.innerHTML = '';

  const mine   = courseExams.filter(e => e.courseId === courseId);
  const sorted = [...mine].sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

  if (sorted.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const locale = appLocale();
  sorted.forEach(exam => {
    const item = document.createElement('div');
    item.className = 'exam-panel-item';
    const dateStr = exam.examDate
      ? new Date(exam.examDate).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
    const typeLabel = window.t(EXAM_TYPE_KEYS[exam.type] || 'examTypeOther');
    item.innerHTML = `
      <div class="exam-panel-item-info">
        <div class="exam-panel-item-name">${escHtml(exam.name)}</div>
        <div class="exam-panel-item-meta">
          <span class="exam-type-badge ${exam.type}">${typeLabel}</span>
          <span>📅 ${dateStr}</span>
          ${courseExamDaysBadge(exam.examDate)}
        </div>
      </div>
      <button class="exam-panel-del-btn" title="${window.t('deleteExam')}">✕</button>
    `;
    item.querySelector('.exam-panel-del-btn').addEventListener('click', e => {
      e.stopPropagation();
      courseExams = courseExams.filter(x => x.id !== exam.id);
      saveExamsLocal(courseExams);
      updateExamNavCard();
      renderCourseExams();
      showToast(window.t('examDeleted'));
    });
    list.appendChild(item);
  });
}

function updateExamNavCard() {
  const mine = courseExams.filter(e => e.courseId === courseId);
  const meta = document.getElementById('examNavMeta');
  if (meta) {
    meta.textContent = mine.length > 0
      ? window.tf('examCount', { n: mine.length })
      : window.t('noExamsHint');
  }
}

// ── Panel navigation: exam nav card ──────────────────────────────────────────
document.getElementById('examNavCard').addEventListener('click', () => {
  document.getElementById('panelOverview').style.display = 'none';
  const pe = document.getElementById('panelExams');
  pe.style.display = 'flex';
  renderCourseExams();
});

document.getElementById('btnExamsBack').addEventListener('click', () => {
  document.getElementById('panelExams').style.display = 'none';
  document.getElementById('panelOverview').style.display = 'block';
});

// ── Exam modal ────────────────────────────────────────────────────────────────
const courseExamModalOverlay = document.getElementById('courseExamModalOverlay');
const courseExamForm = document.getElementById('courseExamForm');

function openCourseExamModal() {
  courseExamForm.reset();
  selectedCourseExamType = 'final';
  document.querySelectorAll('#courseExamTypeGroup .exam-type-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.type === selectedCourseExamType);
  });
  courseExamModalOverlay.classList.add('open');
  document.getElementById('courseExamInputName').focus();
}

function closeCourseExamModal() {
  courseExamModalOverlay.classList.remove('open');
}

document.getElementById('btnAddExamCourse').addEventListener('click', openCourseExamModal);
document.getElementById('courseExamModalClose').addEventListener('click', closeCourseExamModal);
document.getElementById('courseExamBtnCancel').addEventListener('click', closeCourseExamModal);
courseExamModalOverlay.addEventListener('click', e => {
  if (e.target === courseExamModalOverlay) closeCourseExamModal();
});

document.getElementById('courseExamTypeGroup').addEventListener('click', e => {
  const btn = e.target.closest('.exam-type-btn');
  if (!btn) return;
  document.querySelectorAll('#courseExamTypeGroup .exam-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCourseExamType = btn.dataset.type;
});

courseExamForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('courseExamInputName').value.trim();
  const date = document.getElementById('courseExamInputDate').value;
  if (!name) { showToast(window.t('examNameRequired')); return; }
  if (!date) { showToast(window.t('examDateRequired')); return; }

  courseExams.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    courseId,
    name,
    examDate: date,
    type: selectedCourseExamType,
    createdAt: Date.now(),
  });
  saveExamsLocal(courseExams);
  updateExamNavCard();
  renderCourseExams();
  closeCourseExamModal();
  showToast(window.t('examAdded'));
});
```

- [ ] **Step 3: Call `updateExamNavCard()` in the init sequence**

Find the init sequence at the bottom of `course.js`:
```js
renderHeader();
renderChapters();
renderProgress();
renderMaterials();
if (typeof applyStrings === 'function') applyStrings();
```

Add `updateExamNavCard();` after `renderMaterials();`:
```js
renderHeader();
renderChapters();
renderProgress();
renderMaterials();
updateExamNavCard();
if (typeof applyStrings === 'function') applyStrings();
```

- [ ] **Step 4: Bump version in `course.html`**

Find in `course.html`:
```html
<script src="course.js?v=30"></script>
```
Change to:
```html
<script src="course.js?v=31"></script>
```

Also update `AGENT_GUIDELINES.md` line `当前版本：v=30` → `v=31`.

- [ ] **Step 5: Commit Task 6**

```bash
git add course.js course.html .agents/AGENT_GUIDELINES.md
git commit -m "feat(P8): integrate exam management module into course page

Adds exam nav card, exam panel (filtered by courseId), and exam modal
to the course page. Exams created here are stored in shared EXAMS_KEY
with courseId field, visible globally on index page."
```

---

## Task 7 — Final: Update STATUS.md and verify

- [ ] **Step 1: Update STATUS.md**

In `STATUS.md`, update the TASKS section:
- Move P6 data corruption bug to "已验收完成" with version v30
- Move P8 exam module integration to "已验收完成"
- Update "当前版本" to `course.js?v=31`

- [ ] **Step 2: Commit STATUS update**

```bash
git add STATUS.md
git commit -m "docs: update STATUS.md — P6 bug fix and P8 exam integration complete"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task covering it |
|---|---|
| P6: AI chat should not corrupt/lose course data | Task 1 (separate API content), Task 2 (harden storage) |
| P6: Page should remain functional after AI query | Task 2 (prevent QuotaExceededError crash during init) |
| P6: Session history should not grow unbounded | Task 2 (cap at 5 sessions) |
| P8: Exam management integrated into course page | Tasks 4, 5, 6 |
| P8: Exams filtered by current course | Task 6 (filter by courseId) |
| i18n: New strings covered | Task 3 (examCount zh/en/es) |
| Cache-busting: version bumped | Tasks 3 and 6 |

**Type consistency check:**
- `sendAIMsg(userText, displayLabel, apiContent)` — called with `(text, text, apiContent)` in `doSend` ✓ and `(displayLabel, displayLabel, apiContent)` in `handleQuickAction` ✓
- `saveExamsLocal` is used only in `course.js`; it does not conflict with `saveExams` in `app.js` (different function name, same storage key) ✓
- `courseExams` (course-page-local state) vs `exams` in `app.js` — separate module scopes, no conflict ✓
- `EXAM_TYPE_KEYS` defined once in `course.js`; `app.js` already has its own copy ✓
- `daysUntil` is already defined in `course.js` ✓
- `appLocale` is already defined in `course.js` ✓
- `escHtml` is already defined in `course.js` ✓

**Placeholder scan:** No TBDs or unfilled code blocks found.
