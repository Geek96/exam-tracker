# P6 / P7 / P8 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical AI chat data corruption bug (P6), redesign AI file selector UI (P7), and restructure the app as "课程与考试管理" with a new standalone exam module (P8).

**Architecture:** Pure Vanilla JS / HTML / CSS — no build step, no npm packages. All state in localStorage + IndexedDB. The exam module lives entirely in `index.html` + `app.js`. Bug fixes and UI changes are in `course.js` + `course.html`. Strings go in `strings.js` (zh/en/es). Every `course.js` edit requires bumping `?v=N` in `course.html`.

**Tech Stack:** Vanilla JS, localStorage, IndexedDB, Vercel Serverless (no changes to API layer this sprint)

**Current version:** `course.js?v=27` → will reach `v=29` after Task Group A+B.

---

## Scope note

Three task groups touch different files but the same repo. They can be executed independently in order: **A (P6 bug) → B (P7 UI) → C (P8 feature)**. Each group ends with a working, testable state.

---

## File Map

| File | Changed by |
|---|---|
| `course.js` | A (bug fix), B (UI redesign) |
| `course.html` | A (topbar), B (file picker panel HTML), version bump |
| `course.css` | B (file picker dropdown styles) |
| `strings.js` | C (rename + exam strings) |
| `index.html` | C (rename title, remove fields, add exam section + modal) |
| `app.js` | C (exam CRUD, simplify course creation) |
| `styles.css` | C (exam card / badge styles) |
| `STATUS.md` | After each group (update version + completed tasks) |

---

## Task Group A — P6: Fix AI Chat Data Corruption

Root causes:
1. `sendAIMsg` stores the full context message (300 KB of markdown) in `aiConversation`. When `sessPersist()` writes this to localStorage it can hit the ~5 MB quota and silently corrupt other keys including `examTrackerCourses`.
2. `renderSessionMessages()` renders `msg.content` (the full system prompt) as the user bubble instead of what the user actually typed.

---

### Task A-1: Add `display` field to conversation messages

**Files:**
- Modify: `course.js` (lines 2071, 1774-1779, 1741-1744)

- [ ] **Step 1: In `sendAIMsg`, attach `display` label to the pushed message**

Find (line 2071):
```js
  aiConversation.push({ role: 'user', content: userContent });
```
Replace with:
```js
  aiConversation.push({ role: 'user', content: userContent, display: displayLabel || userContent });
```

- [ ] **Step 2: In `renderSessionMessages`, render `display` instead of `content`**

Find (line ~1776-1778):
```js
    if (msg.role === 'user') {
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-user';
      el.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHtml(msg.content)}</div>`;
```
Replace with:
```js
    if (msg.role === 'user') {
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-user';
      el.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHtml(msg.display || msg.content)}</div>`;
```

- [ ] **Step 3: In `sessPersist`, use `display` for session title**

Find (line ~1741-1744):
```js
  const firstUser = aiConversation.find(m => m.role === 'user');
  if (firstUser && s.title === '新对话') {
    s.title = firstUser.content.slice(0, 32) + (firstUser.content.length > 32 ? '…' : '');
  }
```
Replace with:
```js
  const firstUser = aiConversation.find(m => m.role === 'user');
  if (firstUser && s.title === '新对话') {
    const titleSrc = firstUser.display || firstUser.content;
    s.title = titleSrc.slice(0, 32) + (titleSrc.length > 32 ? '…' : '');
  }
```

---

### Task A-2: Prevent localStorage quota overflow in session persistence

**Files:**
- Modify: `course.js` (functions `sessSave`, `sessPersist`)

The fix: when persisting, strip the full injected context from user messages — store only `display` text. Full content stays in memory for the current session API calls. On page reload, restored messages have trimmed content (acceptable: the AI can still see conversation history without the raw 300 KB markdown).

- [ ] **Step 1: Add error handling to `sessSave`**

Find (line ~1723):
```js
function sessSave(s) { localStorage.setItem(sessKey(), JSON.stringify(s)); }
```
Replace with:
```js
function sessSave(s) {
  try {
    localStorage.setItem(sessKey(), JSON.stringify(s));
  } catch {
    try {
      const trimmed = s.slice(0, 3).map(sess => ({
        ...sess,
        messages: sess.messages.slice(-8).map(m => ({ role: m.role, content: (m.display || m.content || '').slice(0, 500), display: m.display })),
      }));
      localStorage.setItem(sessKey(), JSON.stringify(trimmed));
    } catch {}
  }
}
```

- [ ] **Step 2: In `sessPersist`, store display-only version of messages**

Find (line ~1745-1746):
```js
  s.messages = aiConversation.slice();
  sessSave(sessions);
```
Replace with:
```js
  s.messages = aiConversation.map(m => ({
    role: m.role,
    content: m.display || (m.content.length > 2000 ? m.content.slice(0, 2000) + '…' : m.content),
    display: m.display,
  }));
  sessSave(sessions);
```

- [ ] **Step 3: Manual verify — open course page in browser, send "生成复习计划", reload page**

Expected: session title shows "📋 生成复习计划…" (not the raw system prompt). User bubble shows "📋 生成复习计划 · N 天 · 每天 N 小时" (the display label). No data corruption after multiple sends.

---

### Task A-3: Fix topbar "加载中" mystery indicator

**Files:**
- Modify: `course.html` (line 17)

The `data-i18n="loading"` attribute causes `applyStrings()` to show "加载中…" in the topbar before `renderHeader()` overwrites it with the course name. Removing the attribute makes the span start blank — no visible flash.

- [ ] **Step 1: Remove `data-i18n="loading"` from `topbarName`**

Find in `course.html`:
```html
      <span class="topbar-name" id="topbarName" data-i18n="loading">加载中…</span>
```
Replace with:
```html
      <span class="topbar-name" id="topbarName"></span>
```

- [ ] **Step 2: Bump `course.js` version to v=28 in `course.html`**

Find:
```html
  <script src="course.js?v=27"></script>
```
Replace with:
```html
  <script src="course.js?v=28"></script>
```

Also update `AGENT_GUIDELINES.md` line: `当前版本：v=27` → `v=28`.

- [ ] **Step 3: Commit Task Group A**

```bash
git add course.js course.html .agents/AGENT_GUIDELINES.md
git commit -m "fix: P6 - fix AI chat system prompt display and localStorage quota overflow"
```

---

## Task Group B — P7: Redesign AI File Selector

Goal: Remove the hidden 🤖 button from each material card. Instead, make the AI context badge in the chat header clickable — it opens a dropdown panel listing all `.md` files where each row click toggles file selection.

---

### Task B-1: Add file picker panel HTML to `course.html`

**Files:**
- Modify: `course.html` (inside `.ai-client-controls`, after `aiContextBadge`)

- [ ] **Step 1: Wrap `aiContextBadge` in a relative container and add the picker panel**

Find in `course.html`:
```html
            <div class="ai-context-badge" id="aiContextBadge" style="display:none"
              data-i18n-title="aiContextTitle" title="可读取的 Markdown 课程资料">
              <span>📎</span><span id="aiContextCount">0</span>
            </div>
```
Replace with:
```html
            <div class="ai-context-wrap" style="position:relative">
              <button class="ai-context-badge" id="aiContextBadge" style="display:none"
                title="点击选择 AI 可读取的文件">
                <span>📎</span><span id="aiContextCount">0</span>
              </button>
              <div class="ai-file-picker" id="aiFilePicker" style="display:none">
                <div class="ai-file-picker-head" data-i18n="filePickerTitle">选择 AI 可读取的文件</div>
                <div class="ai-file-picker-list" id="aiFilePickerList"></div>
                <div class="ai-file-picker-empty" id="aiFilePickerEmpty" style="display:none" data-i18n="noMdFiles">暂无 Markdown 文件</div>
              </div>
            </div>
```

---

### Task B-2: Add file picker styles to `course.css`

**Files:**
- Modify: `course.css` (append at end)

- [ ] **Step 1: Append dropdown styles**

Append to end of `course.css`:
```css
/* ── AI File Picker Dropdown ─────────────────────────────────────────────── */
.ai-context-wrap { position: relative; }

.ai-context-badge {
  display: flex; align-items: center; gap: 5px;
  background: rgba(91,141,239,.15); border: 1px solid rgba(91,141,239,.35);
  border-radius: 20px; padding: 4px 10px; font-size: 12px; color: var(--accent);
  cursor: pointer; white-space: nowrap;
}
.ai-context-badge:hover { background: rgba(91,141,239,.25); }

.ai-file-picker {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 200;
  width: 260px; background: var(--card); border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.45);
  overflow: hidden;
}
.ai-file-picker-head {
  padding: 8px 12px; font-size: 11px; color: var(--muted);
  border-bottom: 1px solid rgba(255,255,255,.07); text-transform: uppercase; letter-spacing: .04em;
}
.ai-file-picker-list { max-height: 220px; overflow-y: auto; }
.ai-file-picker-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  cursor: pointer; font-size: 13px; transition: background .15s;
}
.ai-file-picker-row:hover { background: rgba(255,255,255,.05); }
.ai-file-picker-row.selected { background: rgba(91,141,239,.12); }
.ai-file-picker-check {
  width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid rgba(255,255,255,.25);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 10px; transition: all .15s;
}
.ai-file-picker-row.selected .ai-file-picker-check {
  background: var(--accent); border-color: var(--accent); color: #fff;
}
.ai-file-picker-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-file-picker-empty { padding: 16px 12px; font-size: 12px; color: var(--muted); text-align: center; }
```

---

### Task B-3: Implement file picker logic in `course.js`

**Files:**
- Modify: `course.js` (several sections)

- [ ] **Step 1: Remove the 🤖 button from `renderMaterials`**

Find in `course.js` inside `renderMaterials` (around line 1511-1512):
```js
      <div class="material-card-actions">
        ${isSelectable ? `<button class="btn-mat-sel${isSelected ? ' selected' : ''}" title="${window.t('aiFileSelectTitle')}">🤖</button>` : ''}
```
Replace with:
```js
      <div class="material-card-actions">
```

- [ ] **Step 2: Remove the 🤖 button click handler from `renderMaterials`**

Find in `course.js` (around lines 1517-1531):
```js
    if (isSelectable) {
      const selBtn = card.querySelector('.btn-mat-sel');
      selBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (selectedFiles.has(f.id)) {
          selectedFiles.delete(f.id);
          selBtn.classList.remove('selected');
        } else {
          selectedFiles.add(f.id);
          selBtn.classList.add('selected');
        }
        saveFileSelection(selectedFiles);
        refreshContextBadge();
      });
    }
```
Delete this entire block.

- [ ] **Step 3: Add `renderFilePicker` function and toggle logic**

After the `refreshContextBadge` function (around line 1858), add:
```js
// ── AI File Picker ────────────────────────────────────────────────────────────
async function renderFilePicker() {
  const all  = await dbGetAll();
  const mds  = all.filter(f => f.courseId === courseId && (f.name || '').toLowerCase().endsWith('.md'));
  const list  = document.getElementById('aiFilePickerList');
  const empty = document.getElementById('aiFilePickerEmpty');
  if (!list) return;
  list.innerHTML = '';

  if (mds.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  mds.forEach(f => {
    const isSelected = selectedFiles.size === 0 || selectedFiles.has(f.id);
    const row = document.createElement('div');
    row.className = 'ai-file-picker-row' + (isSelected ? ' selected' : '');
    row.innerHTML = `<div class="ai-file-picker-check">${isSelected ? '✓' : ''}</div><div class="ai-file-picker-name" title="${escHtml(f.name)}">📋 ${escHtml(f.name)}</div>`;
    row.addEventListener('click', () => {
      if (selectedFiles.size === 0) {
        // Currently "all selected" mode — switch to explicit: select all except this one
        mds.forEach(m => { if (m.id !== f.id) selectedFiles.add(m.id); });
      } else if (selectedFiles.has(f.id)) {
        selectedFiles.delete(f.id);
        if (selectedFiles.size === 0) {
          // All deselected means all-selected mode — keep set empty = all selected
        }
      } else {
        selectedFiles.add(f.id);
      }
      saveFileSelection(selectedFiles);
      refreshContextBadge();
      renderFilePicker();
    });
    list.appendChild(row);
  });
}

const aiContextBadge  = document.getElementById('aiContextBadge');
const aiFilePickerEl  = document.getElementById('aiFilePicker');

if (aiContextBadge) {
  aiContextBadge.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = aiFilePickerEl.style.display !== 'none';
    if (isOpen) {
      aiFilePickerEl.style.display = 'none';
    } else {
      aiFilePickerEl.style.display = 'block';
      await renderFilePicker();
    }
  });
  document.addEventListener('click', (e) => {
    if (!aiFilePickerEl.contains(e.target) && e.target !== aiContextBadge) {
      aiFilePickerEl.style.display = 'none';
    }
  });
}
```

- [ ] **Step 4: Add new i18n keys to `strings.js`**

In the `zh` object, find the end (before closing `},`), add:
```js
    filePickerTitle: 'AI 可读取的文件', noMdFiles: '暂无 Markdown 文件',
```
In the `en` object, add:
```js
    filePickerTitle: 'Files AI can read', noMdFiles: 'No Markdown files yet',
```
In the `es` object, add:
```js
    filePickerTitle: 'Archivos que puede leer la IA', noMdFiles: 'Sin archivos Markdown aún',
```

- [ ] **Step 5: Remove the deleted `aiContextBadge` DOM reference at top of course.js**

There is a DOM ref at the top grabbing `aiContextBadge` by `getElementById` — search for it:
```js
const aiContextBadge = document.getElementById('aiContextBadge');
```
If this exists as a top-level `const`, it will conflict with the new `const` added in Step 3. Search the file and remove the old top-level declaration (keep only the one inside the picker block).

Run:
```bash
grep -n "aiContextBadge" course.js
```
If there's a top-level `const aiContextBadge = document.getElementById('aiContextBadge');`, delete that line. The new declaration added in Step 3 replaces it.

- [ ] **Step 6: Bump version to v=29 in `course.html`**

Find:
```html
  <script src="course.js?v=28"></script>
```
Replace with:
```html
  <script src="course.js?v=29"></script>
```

Update `AGENT_GUIDELINES.md`: `当前版本：v=28` → `v=29`.

- [ ] **Step 7: Manual verify in browser**

1. Open a course page that has .md materials.
2. Confirm 🤖 button is gone from material cards.
3. Click the 📎 badge in the AI header — a dropdown opens listing .md files with checkboxes.
4. Click a row to toggle selection. Badge count updates.
5. Close by clicking outside the dropdown.

- [ ] **Step 8: Commit Task Group B**

```bash
git add course.js course.html course.css strings.js .agents/AGENT_GUIDELINES.md
git commit -m "feat: P7 - redesign AI file selector as clickable dropdown badge"
```

---

## Task Group C — P8: Rename App + Exam Management Module

### Task C-1: Rename app from "复习追踪器" to "课程与考试管理"

**Files:**
- Modify: `strings.js`, `index.html`, `course.html`, `welcome.html`

- [ ] **Step 1: Update `appName` and `pageTitle` in all three languages in `strings.js`**

In `zh` object:
```js
appName: '复习追踪器',   →   appName: '课程与考试管理',
pageTitle: '考试复习追踪器',  →   pageTitle: '课程与考试管理',
```
In `en` object:
```js
appName: 'Study Tracker',   →   appName: 'Course & Exam Manager',
pageTitle: 'Exam Study Tracker',  →   pageTitle: 'Course & Exam Manager',
```
In `es` object (find current value and replace):
```js
appName: 'Rastreador de Estudio',  →  appName: 'Gestor de Cursos y Exámenes',
pageTitle: 'Rastreador de Exámenes',  →  pageTitle: 'Gestor de Cursos y Exámenes',
```

- [ ] **Step 2: Update `<title>` in `index.html`**

Find:
```html
  <title>考试复习追踪器</title>
```
Replace with:
```html
  <title>课程与考试管理</title>
```

- [ ] **Step 3: Update `<title>` in `course.html`**

Find:
```html
  <title>课程详情 - 复习追踪器</title>
```
Replace with:
```html
  <title>课程详情 - 课程与考试管理</title>
```

- [ ] **Step 4: Check `welcome.html` for hardcoded app name**

Run:
```bash
grep -n "复习追踪器\|Study Tracker" welcome.html
```
If found, update to "课程与考试管理" / "Course & Exam Manager". If it uses `data-i18n="appName"` it will update automatically.

---

### Task C-2: Simplify course creation form (remove exam date + total chapters)

**Files:**
- Modify: `index.html`, `app.js`

- [ ] **Step 1: Remove `examDate` and `totalChapters` fields from the Add Course form in `index.html`**

Find in `index.html`:
```html
        <label class="form-label" data-i18n="examDate">考试日期</label>
        <input class="form-input" type="date" id="inputDate" />

        <label class="form-label" data-i18n="totalChapters">章节总数</label>
        <input class="form-input" type="number" id="inputTotal" data-i18n-ph="totalChaptersPh" placeholder="例：12" min="1" max="999" />
```
Delete both label+input pairs (4 lines total).

- [ ] **Step 2: Update form submission in `app.js` to not read the removed fields**

Find in `app.js`:
```js
  const course = createCourse({
    name,
    subject:     document.getElementById('inputSubject').value.trim(),
    examDate:    document.getElementById('inputDate').value,
    totalTopics: document.getElementById('inputTotal').value,
    color:       selectedColor,
  });
```
Replace with:
```js
  const course = createCourse({
    name,
    subject: document.getElementById('inputSubject').value.trim(),
    color:   selectedColor,
  });
```

- [ ] **Step 3: Update `createCourse` function signature in `app.js` to make removed fields optional**

Find:
```js
function createCourse({ name, subject, examDate, totalTopics, color }) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    subject: subject || '',
    examDate: examDate || '',
    totalTopics: parseInt(totalTopics) || 0,
    completedTopics: 0,
    color,
    createdAt: Date.now(),
  };
}
```
Replace with:
```js
function createCourse({ name, subject, color }) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    subject: subject || '',
    examDate: '',
    totalTopics: 0,
    completedTopics: 0,
    color,
    createdAt: Date.now(),
  };
}
```

---

### Task C-3: Add Exam Management strings to `strings.js`

**Files:**
- Modify: `strings.js`

- [ ] **Step 1: Add exam strings to `zh` object** (before closing `},`)

```js
    examsSection: '考试管理', addExam: '添加考试', addExamTitle: '添加新考试',
    examName: '考试名称', examNamePh: '例：期末数学考试',
    examType: '考试类型',
    examTypeOpening: '开学测验', examTypeMidterm: '期中测验', examTypeFinal: '期末考',
    examTypeQuiz: '小测', examTypeCredit: '学分考', examTypeOther: '其他',
    deleteExam: '删除', examAdded: '考试已添加 ✓', examDeleted: '已删除考试',
    noExamsTitle: '暂无考试安排', noExamsHint: '点击「添加考试」新增一场考试',
    examDateRequired: '请填写考试日期', examNameRequired: '请填写考试名称',
    myExams: '我的考试',
```

- [ ] **Step 2: Add exam strings to `en` object**

```js
    examsSection: 'Exam Management', addExam: 'Add Exam', addExamTitle: 'Add New Exam',
    examName: 'Exam Name', examNamePh: 'e.g. Final Math Exam',
    examType: 'Exam Type',
    examTypeOpening: 'Opening Test', examTypeMidterm: 'Midterm', examTypeFinal: 'Final Exam',
    examTypeQuiz: 'Quiz', examTypeCredit: 'Credit Exam', examTypeOther: 'Other',
    deleteExam: 'Delete', examAdded: 'Exam added ✓', examDeleted: 'Exam deleted',
    noExamsTitle: 'No exams scheduled', noExamsHint: 'Click "Add Exam" to schedule one',
    examDateRequired: 'Please enter the exam date', examNameRequired: 'Please enter an exam name',
    myExams: 'My Exams',
```

- [ ] **Step 3: Add exam strings to `es` object**

```js
    examsSection: 'Gestión de Exámenes', addExam: 'Añadir Examen', addExamTitle: 'Añadir Nuevo Examen',
    examName: 'Nombre del Examen', examNamePh: 'ej. Examen Final de Matemáticas',
    examType: 'Tipo de Examen',
    examTypeOpening: 'Test de Inicio', examTypeMidterm: 'Examen Parcial', examTypeFinal: 'Examen Final',
    examTypeQuiz: 'Prueba', examTypeCredit: 'Examen de Crédito', examTypeOther: 'Otro',
    deleteExam: 'Eliminar', examAdded: 'Examen añadido ✓', examDeleted: 'Examen eliminado',
    noExamsTitle: 'Sin exámenes programados', noExamsHint: 'Haz clic en "Añadir Examen" para programar uno',
    examDateRequired: 'Por favor ingresa la fecha del examen', examNameRequired: 'Por favor ingresa el nombre del examen',
    myExams: 'Mis Exámenes',
```

---

### Task C-4: Add Exam section HTML to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add exam section and modal after the course grid**

Find in `index.html` (just before `<!-- Delete confirm toast -->`):
```html
  <!-- Delete confirm toast -->
```
Insert before it:
```html
  <!-- ── Exam Section ── -->
  <section class="exam-section">
    <div class="section-row">
      <h2 class="section-title" data-i18n="myExams">我的考试</h2>
      <button class="btn-add" id="btnAddExam">
        <span class="btn-add-icon">+</span> <span data-i18n="addExam">添加考试</span>
      </button>
    </div>
    <div class="exam-empty" id="examEmpty">
      <div class="empty-icon">📅</div>
      <p class="empty-title" data-i18n="noExamsTitle">暂无考试安排</p>
      <p class="empty-sub" data-i18n="noExamsHint">点击「添加考试」新增一场考试</p>
    </div>
    <div class="exam-list" id="examList"></div>
  </section>

  <!-- Add Exam Modal -->
  <div class="modal-overlay" id="examModalOverlay">
    <div class="modal" id="examModal">
      <div class="modal-header">
        <h3 class="modal-title" data-i18n="addExamTitle">添加新考试</h3>
        <button class="modal-close" id="examModalClose">✕</button>
      </div>
      <form class="modal-form" id="examForm">
        <label class="form-label"><span data-i18n="examName">考试名称</span> <span class="required">*</span></label>
        <input class="form-input" type="text" id="examInputName" data-i18n-ph="examNamePh" placeholder="例：期末数学考试" maxlength="60" required />

        <label class="form-label"><span data-i18n="examDate">考试日期</span> <span class="required">*</span></label>
        <input class="form-input" type="date" id="examInputDate" required />

        <label class="form-label" data-i18n="examType">考试类型</label>
        <div class="exam-type-group" id="examTypeGroup">
          <button type="button" class="exam-type-btn selected" data-type="final" data-i18n="examTypeFinal">期末考</button>
          <button type="button" class="exam-type-btn" data-type="midterm" data-i18n="examTypeMidterm">期中测验</button>
          <button type="button" class="exam-type-btn" data-type="quiz" data-i18n="examTypeQuiz">小测</button>
          <button type="button" class="exam-type-btn" data-type="opening" data-i18n="examTypeOpening">开学测验</button>
          <button type="button" class="exam-type-btn" data-type="credit" data-i18n="examTypeCredit">学分考</button>
          <button type="button" class="exam-type-btn" data-type="other" data-i18n="examTypeOther">其他</button>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" id="examBtnCancel" data-i18n="cancel">取消</button>
          <button type="submit" class="btn-submit" data-i18n="addExam">添加考试</button>
        </div>
      </form>
    </div>
  </div>
```

---

### Task C-5: Add Exam CSS to `styles.css`

**Files:**
- Modify: `styles.css` (append at end)

- [ ] **Step 1: Append exam styles**

```css
/* ── Exam Section ──────────────────────────────────────────────────────────── */
.exam-section { margin-top: 40px; }

.exam-empty { text-align: center; padding: 40px 20px; opacity: .6; }

.exam-list { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

.exam-item {
  display: flex; align-items: center; gap: 14px;
  background: var(--card); border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px; padding: 14px 16px;
  transition: background .15s;
}
.exam-item:hover { background: rgba(255,255,255,.05); }

.exam-item-info { flex: 1; min-width: 0; }
.exam-item-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.exam-item-meta { font-size: 12px; color: var(--muted); display: flex; gap: 10px; align-items: center; }

.exam-type-badge {
  display: inline-block; font-size: 11px; padding: 2px 8px;
  border-radius: 20px; font-weight: 600;
  background: rgba(91,141,239,.15); color: var(--accent);
  border: 1px solid rgba(91,141,239,.3);
}
.exam-type-badge.final  { background: rgba(249,123,107,.15); color: #F97B6B; border-color: rgba(249,123,107,.3); }
.exam-type-badge.midterm { background: rgba(240,180,41,.15); color: #F0B429; border-color: rgba(240,180,41,.3); }
.exam-type-badge.quiz   { background: rgba(89,193,133,.15); color: #59C185; border-color: rgba(89,193,133,.3); }
.exam-type-badge.credit { background: rgba(167,139,250,.15); color: #A78BFA; border-color: rgba(167,139,250,.3); }
.exam-type-badge.opening { background: rgba(56,189,248,.15); color: #38BDF8; border-color: rgba(56,189,248,.3); }

.exam-item-days { font-size: 12px; font-weight: 600; white-space: nowrap; }
.exam-item-days.urgent { color: #F97B6B; }
.exam-item-days.soon   { color: #F0B429; }

.exam-del-btn {
  background: none; border: none; color: var(--muted); cursor: pointer;
  font-size: 13px; padding: 4px 8px; border-radius: 6px; transition: all .15s;
}
.exam-del-btn:hover { background: rgba(249,123,107,.15); color: #F97B6B; }

/* ── Exam Type Button Group (modal) ────────────────────────────────────────── */
.exam-type-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.exam-type-btn {
  padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  color: var(--muted); cursor: pointer; transition: all .15s;
}
.exam-type-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
.exam-type-btn.selected { background: rgba(91,141,239,.2); border-color: var(--accent); color: var(--accent); }
```

---

### Task C-6: Add Exam CRUD logic to `app.js`

**Files:**
- Modify: `app.js` (append at end)

- [ ] **Step 1: Append exam management code to `app.js`**

```js
// ── Exam Management ───────────────────────────────────────────────────────────

const EXAMS_KEY = 'examTrackerExams';

function loadExams() {
  try { return JSON.parse(localStorage.getItem(EXAMS_KEY)) || []; }
  catch { return []; }
}
function saveExams(exams) { localStorage.setItem(EXAMS_KEY, JSON.stringify(exams)); }

let exams = loadExams();
let selectedExamType = 'final';

const EXAM_TYPE_KEYS = {
  opening: 'examTypeOpening', midterm: 'examTypeMidterm', final: 'examTypeFinal',
  quiz: 'examTypeQuiz', credit: 'examTypeCredit', other: 'examTypeOther',
};

function examDaysBadge(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d < 0)  return `<span class="exam-item-days urgent">${window.t('expired')}</span>`;
  if (d === 0) return `<span class="exam-item-days urgent">${window.t('examToday')}</span>`;
  const label = window.tf('daysLeft', { n: d });
  if (d <= 7)  return `<span class="exam-item-days urgent">${label}</span>`;
  if (d <= 30) return `<span class="exam-item-days soon">${label}</span>`;
  return `<span class="exam-item-days">${label}</span>`;
}

function renderExams() {
  const list  = document.getElementById('examList');
  const empty = document.getElementById('examEmpty');
  if (!list) return;
  list.innerHTML = '';

  const sorted = [...exams].sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

  if (sorted.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const lang   = localStorage.getItem('app_lang') || 'zh';
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'es' ? 'es-ES' : 'en-US';

  sorted.forEach(exam => {
    const item = document.createElement('div');
    item.className = 'exam-item';
    const dateStr = exam.examDate
      ? new Date(exam.examDate).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
    const typeLabel = window.t(EXAM_TYPE_KEYS[exam.type] || 'examTypeOther');
    item.innerHTML = `
      <div class="exam-item-info">
        <div class="exam-item-name">${escHtml(exam.name)}</div>
        <div class="exam-item-meta">
          <span class="exam-type-badge ${exam.type}">${typeLabel}</span>
          <span>📅 ${dateStr}</span>
          ${examDaysBadge(exam.examDate)}
        </div>
      </div>
      <button class="exam-del-btn" title="${window.t('deleteExam')}">✕</button>
    `;
    item.querySelector('.exam-del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      exams = exams.filter(x => x.id !== exam.id);
      saveExams(exams);
      renderExams();
      showToast(window.t('examDeleted'));
    });
    list.appendChild(item);
  });
}

// Exam Modal
const examModalOverlay = document.getElementById('examModalOverlay');
const examForm = document.getElementById('examForm');

function openExamModal() {
  examForm.reset();
  selectedExamType = 'final';
  document.querySelectorAll('.exam-type-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.type === selectedExamType);
  });
  examModalOverlay.classList.add('open');
  document.getElementById('examInputName').focus();
}
function closeExamModal() { examModalOverlay.classList.remove('open'); }

document.getElementById('btnAddExam').addEventListener('click', openExamModal);
document.getElementById('examModalClose').addEventListener('click', closeExamModal);
document.getElementById('examBtnCancel').addEventListener('click', closeExamModal);
examModalOverlay.addEventListener('click', (e) => { if (e.target === examModalOverlay) closeExamModal(); });

document.getElementById('examTypeGroup').addEventListener('click', (e) => {
  const btn = e.target.closest('.exam-type-btn');
  if (!btn) return;
  document.querySelectorAll('.exam-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedExamType = btn.dataset.type;
});

examForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('examInputName').value.trim();
  const date = document.getElementById('examInputDate').value;
  if (!name) { showToast(window.t('examNameRequired')); return; }
  if (!date) { showToast(window.t('examDateRequired')); return; }

  exams.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, examDate: date, type: selectedExamType, createdAt: Date.now(),
  });
  saveExams(exams);
  renderExams();
  closeExamModal();
  showToast(window.t('examAdded'));
});

renderExams();
```

- [ ] **Step 2: Verify `escHtml` is available in `app.js`**

Run:
```bash
grep -n "escHtml" app.js
```
If it's not defined, add this near the top of `app.js` (before `renderCard`):
```js
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

- [ ] **Step 3: Manual verify**

1. Open `index.html` in browser.
2. Confirm app title is now "课程与考试管理".
3. "Add Course" modal no longer has exam date or total chapters fields.
4. Exam section appears below courses. Click "添加考试".
5. Fill name, date, select type. Submit. Exam card appears.
6. Delete button removes exam. Refreshing page restores exams from localStorage.

- [ ] **Step 4: Commit Task Group C**

```bash
git add index.html app.js strings.js styles.css course.html
git commit -m "feat: P8 - rename app, simplify course form, add exam management module"
```

---

### Task C-7: Update STATUS.md

- [ ] **Step 1: Update STATUS.md**

Update `STATUS.md`:
- Version: `course.js?v=29`
- Move P6/P7/P8 from pending to "已验收完成" table (after user acceptance)
- Update "近期变更" with the new commits

---

## Self-Review Checklist

**Spec coverage:**
- [x] P6 system prompt display bug → Task A-1 (display field)
- [x] P6 localStorage corruption → Task A-2 (sessSave error handling + message trimming)
- [x] P7 remove 🤖 button → Task B-3 Step 1+2
- [x] P7 "加载中" fix → Task A-3
- [x] P7 clickable file selector → Task B-1 through B-3
- [x] P8 rename app → Task C-1
- [x] P8 simplify course form → Task C-2
- [x] P8 exam module (date/name/type) → Task C-3 through C-6

**Placeholder scan:** None — all steps include concrete code.

**Type consistency:**
- `selectedFiles` (Set) used consistently across Tasks A+B
- `exams` array and `EXAMS_KEY` used in Task C-6 only (no cross-task conflict)
- `display` field added in Task A-1 is read in A-2 (sessPersist) and A-1 (renderSessionMessages) — consistent
- `examType` values: `final/midterm/quiz/opening/credit/other` — consistent between modal buttons (`data-type`), CSS classes (`.exam-type-badge.final`), and `EXAM_TYPE_KEYS` map

---

**Execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task group, review between groups
2. **Inline Execution** — execute tasks in this session using superpowers:executing-plans
