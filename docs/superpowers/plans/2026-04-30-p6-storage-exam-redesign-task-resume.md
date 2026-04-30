# P6/P8 Follow-up: Storage Fix, Exam Redesign, MinerU Task Resume

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix localStorage overflow causing file/chat loss on navigation; redesign main-page exam module as read-only upcoming reminders; persist MinerU task IDs so polling resumes after page navigation.

**Architecture:**
- Task 1 moves AI chat sessions from localStorage (~80 KB per course) to IndexedDB, freeing quota and preventing silent write failures that cause disappearing files/history.
- Task 2 replaces the full exam CRUD on index.html with a one-line-per-course upcoming-exam widget; exam management stays on course.html.
- Task 3 persists active MinerU task IDs in localStorage so course.html can resume polling after the user navigates away and returns.

**Tech Stack:** Vanilla JS, IndexedDB (existing), localStorage, Node.js `node:test` for static code assertions.

---

## File Map

| File | Tasks | Change type |
|---|---|---|
| `course.js` | 1, 3 | Modify: session functions, getDB, MinerU persistence |
| `course.html` | 1, 3 | Modify: bump `?v=N` twice (→32, →33) |
| `index.html` | 2 | Modify: replace exam section + remove exam modal |
| `app.js` | 2 | Modify: replace exam CRUD with upcoming widget |
| `styles.css` | 2 | Modify: add upcoming exam item styles |
| `strings.js` | 2 | Modify: add 2 new i18n keys (zh/en/es) |
| `STATUS.md` | 1, 3 | Modify: bump current version |
| `tests/p6-p8-regression.test.js` | 1, 2, 3 | Modify: add assertions |

---

## Task 1: Migrate AI Chat Sessions from localStorage to IndexedDB

**Root cause:** `chatSessions_${courseId}` in localStorage accumulates message history and can consume ~80 KB per course. When total localStorage approaches 5 MB, `saveCourses`, `saveFileSelection`, and `sessSave` all fail silently. On the next page load, the user sees empty file selection and empty history.

**Fix:** Store sessions in the existing `examTrackerFiles` IndexedDB database (new object store `chatSessions`). Only the active session ID (`chatActive_*`, a short string) stays in localStorage.

### Files
- Modify: `course.js` (multiple sections)
- Modify: `course.html` (version bump v=31 → v=32)
- Modify: `STATUS.md`
- Modify: `tests/p6-p8-regression.test.js`

---

- [ ] **Step 1.1: Write the failing test**

Append to `tests/p6-p8-regression.test.js`:

```js
test('Task1 AI sessions stored in IndexedDB not localStorage', () => {
  const src = read('course.js');

  // IDB version 2 with chatSessions store
  assert.match(src, /indexedDB\.open\('examTrackerFiles',\s*2\)/);
  assert.match(src, /createObjectStore\('chatSessions'/);

  // IDB session helpers exist
  assert.match(src, /async function dbGetSessions\(cid\)/);
  assert.match(src, /async function dbSaveSessions\(cid,\s*sessions\)/);

  // Session cache variable
  assert.match(src, /let _sessCache\s*=\s*\[\]/);

  // sessLoad returns cache
  assert.match(src, /function sessLoad\(\)\s*\{\s*return _sessCache;\s*\}/);

  // sessSave updates cache and writes to IDB asynchronously
  assert.match(src, /_sessCache\s*=\s*s/);
  assert.match(src, /dbSaveSessions\(courseId,\s*s\)/);

  // initSessions is an async function (not an IIFE)
  assert.match(src, /async function initSessions\(\)/);

  // localStorage sessKey usage removed
  assert.doesNotMatch(src, /chatSessions_\$\{courseId\}/);

  // version bump
  assert.match(read('course.html'), /course\.js\?v=32/);
});
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
node --test tests/p6-p8-regression.test.js
```

Expected: FAIL on "Task1 AI sessions stored in IndexedDB not localStorage" (all assertions fail).

---

- [ ] **Step 1.3: Upgrade `getDB()` to version 2 with `chatSessions` store**

In `course.js`, find the `getDB()` function (around line 1447) and replace:

```js
function getDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('examTrackerFiles', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('files', { keyPath: 'id' });
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror = () => rej(req.error);
  });
}
```

with:

```js
function getDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('examTrackerFiles', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chatSessions')) {
        db.createObjectStore('chatSessions', { keyPath: 'courseId' });
      }
    };
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror = () => rej(req.error);
    req.onblocked = () => rej(new Error('IDB upgrade blocked'));
  });
}
```

---

- [ ] **Step 1.4: Add IDB session helpers after `dbDelete()`**

After the `dbDelete` function (around line 1481), insert:

```js
async function dbGetSessions(cid) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction('chatSessions', 'readonly')
      .objectStore('chatSessions').get(cid);
    req.onsuccess = () => res(req.result ? req.result.sessions : []);
    req.onerror = () => rej(req.error);
  });
}

async function dbSaveSessions(cid, sessions) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('chatSessions', 'readwrite');
    tx.objectStore('chatSessions').put({ courseId: cid, sessions });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
```

---

- [ ] **Step 1.5: Replace session localStorage functions**

In `course.js`, find the session storage block (around line 1729):

```js
// ── Multi-session conversation storage ────────────────────────────────────────
function sessKey()   { return `chatSessions_${courseId}`; }
function actKey()    { return `chatActive_${courseId}`; }
function sessLoad()  { return JSON.parse(localStorage.getItem(sessKey()) || '[]'); }
function sessSave(s) {
  try {
    localStorage.setItem(sessKey(), JSON.stringify(s));
  } catch {
    try {
      const trimmed = s.slice(0, 3).map(sess => ({
        ...sess,
        messages: sess.messages.slice(-8).map(m => ({
          role: m.role,
          content: (m.display || m.content || '').slice(0, 500),
          display: m.display,
        })),
      }));
      localStorage.setItem(sessKey(), JSON.stringify(trimmed));
    } catch {}
  }
}
```

Replace with:

```js
// ── Multi-session conversation storage (IndexedDB) ────────────────────────────
let _sessCache = [];
function actKey()    { return `chatActive_${courseId}`; }
function sessLoad()  { return _sessCache; }
function sessSave(s) {
  _sessCache = s;
  dbSaveSessions(courseId, s).catch(e =>
    console.warn('[ExamTracker] sessSave IDB failed', e)
  );
}
```

---

- [ ] **Step 1.6: Convert `initSessions` IIFE to async named function**

Find the IIFE at the end of the session init block (around line 1843):

```js
// Init sessions on load
(function initSessions() {
  let sessions = sessLoad();
  let activeId = actGet();
  if (!sessions.length || !sessions.find(s => s.id === activeId)) {
    if (!sessions.length) { sessCreate(''); activeId = actGet(); sessions = sessLoad(); }
    else { activeId = sessions[0].id; actSet(activeId); }
  }
  const active = sessions.find(s => s.id === activeId);
  if (active && active.messages.length) {
    aiConversation = active.messages.slice();
    renderSessionMessages();
  }
})();
```

Replace with:

```js
// Init sessions (async: loads from IndexedDB, migrates from localStorage if needed)
async function initSessions() {
  const lsKey = `chatSessions_${courseId}`;
  const lsRaw = localStorage.getItem(lsKey);
  if (lsRaw) {
    try {
      _sessCache = JSON.parse(lsRaw) || [];
      await dbSaveSessions(courseId, _sessCache);
      localStorage.removeItem(lsKey);
    } catch {}
  } else {
    _sessCache = await dbGetSessions(courseId).catch(() => []);
  }

  let sessions = sessLoad();
  let activeId = actGet();
  if (!sessions.length || !sessions.find(s => s.id === activeId)) {
    if (!sessions.length) { sessCreate(''); activeId = actGet(); sessions = sessLoad(); }
    else { activeId = sessions[0].id; actSet(activeId); }
  }
  const active = sessions.find(s => s.id === activeId);
  if (active && active.messages.length) {
    aiConversation = active.messages.slice();
    renderSessionMessages();
  }
}
```

---

- [ ] **Step 1.7: Call `initSessions()` at page init (bottom of `course.js`)**

In the init block at the bottom of `course.js` (around line 2572), find:

```js
// ── Init ──────────────────────────────────────────────────────────────────────
renderHeader();
renderChapters();
renderProgress();
renderMaterials();
updateExamNavCard();
if (typeof applyStrings === 'function') applyStrings();
```

Add after `updateExamNavCard();`:

```js
initSessions().catch(e => console.warn('[ExamTracker] initSessions failed', e));
```

---

- [ ] **Step 1.8: Bump version in `course.html`**

In `course.html`, change:
```html
<script src="course.js?v=31"></script>
```
to:
```html
<script src="course.js?v=32"></script>
```

---

- [ ] **Step 1.9: Run test to confirm it passes**

```bash
node --test tests/p6-p8-regression.test.js
```

Expected: All tests PASS including the new "Task1" test.

---

- [ ] **Step 1.10: Update `STATUS.md` and commit**

In `STATUS.md`, update version to `course.js?v=32`.

```bash
git add course.js course.html STATUS.md tests/p6-p8-regression.test.js
git commit -m "feat: migrate AI chat sessions from localStorage to IndexedDB (v=32)"
```

---

## Task 2: Redesign Main Page Exam Section as Upcoming Exam Reminders

**Goal:** Replace the full exam CRUD on `index.html` with a read-only widget. Each course's nearest upcoming exam is shown, sorted by date. Clicking an item navigates to the course. Exam management remains on `course.html`.

### Files
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `strings.js`
- Modify: `tests/p6-p8-regression.test.js`

---

- [ ] **Step 2.1: Write the failing test**

Append to `tests/p6-p8-regression.test.js`:

```js
test('Task2 main page shows upcoming exam reminders not CRUD', () => {
  const html = read('index.html');
  const js   = read('app.js');
  const css  = read('styles.css');

  // New widget HTML exists
  assert.match(html, /id="upcomingExamsList"/);
  assert.match(html, /id="upcomingExamsEmpty"/);

  // Old exam CRUD modal removed
  assert.doesNotMatch(html, /id="examModalOverlay"/);
  assert.doesNotMatch(html, /id="btnAddExam"/);

  // New render function in app.js
  assert.match(js, /function renderUpcomingExams\(\)/);

  // Old exam CRUD functions removed from app.js
  assert.doesNotMatch(js, /function renderExams\(\)/);
  assert.doesNotMatch(js, /function openExamModal\(\)/);

  // New styles exist
  assert.match(css, /\.upcoming-exam-item/);
});
```

- [ ] **Step 2.2: Run test to confirm it fails**

```bash
node --test tests/p6-p8-regression.test.js
```

Expected: FAIL on "Task2" test.

---

- [ ] **Step 2.3: Add i18n keys to `strings.js`**

In `strings.js`, add to the `zh` object (e.g., after `myExams`):
```js
upcomingExams: '临近考试',
noUpcomingExams: '各课程还没有添加考试',
unknownCourse: '未知课程',
```

Add to the `en` object:
```js
upcomingExams: 'Upcoming Exams',
noUpcomingExams: 'No exams added to any course yet',
unknownCourse: 'Unknown Course',
```

Add to the `es` object:
```js
upcomingExams: 'Próximos Exámenes',
noUpcomingExams: 'Aún no se han añadido exámenes a ningún curso',
unknownCourse: 'Curso desconocido',
```

---

- [ ] **Step 2.4: Replace exam section in `index.html`**

Find and replace the entire `<section class="exam-section">...</section>`:

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
```

with:

```html
    <!-- ── Upcoming Exams ── -->
    <section class="upcoming-exams-section">
      <div class="section-row">
        <h2 class="section-title" data-i18n="upcomingExams">临近考试</h2>
      </div>
      <div class="upcoming-exams-empty" id="upcomingExamsEmpty" style="display:none">
        <div class="empty-icon">📅</div>
        <p class="empty-title" data-i18n="noUpcomingExams">各课程还没有添加考试</p>
      </div>
      <div class="upcoming-exams-list" id="upcomingExamsList"></div>
    </section>
```

Also remove the entire `<!-- Add Exam Modal -->` block:

```html
  <!-- Add Exam Modal -->
  <div class="modal-overlay" id="examModalOverlay">
    ...
  </div>
```

(The full block is lines 106–135 of `index.html`.)

---

- [ ] **Step 2.5: Replace exam CRUD in `app.js`**

In `app.js`, remove the entire block from `// ── Exam Management ───` (line 271) through the end of `renderExams();` (last line, around line 438). Replace with the following (keep `loadExams`, `daysUntil`, `examDaysBadge` which are already above this block):

```js
// ── Upcoming Exam Reminders ───────────────────────────────────────────────────

const EXAM_TYPE_KEYS_HOME = {
  opening: 'examTypeOpening', midterm: 'examTypeMidterm', final: 'examTypeFinal',
  quiz: 'examTypeQuiz', credit: 'examTypeCredit', other: 'examTypeOther',
};

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderUpcomingExams() {
  const wrap  = document.getElementById('upcomingExamsList');
  const empty = document.getElementById('upcomingExamsEmpty');
  if (!wrap || !empty) return;

  const allExams = loadExams();
  const now = Date.now();

  // Per course: pick nearest future exam; fallback to most-recent past exam
  const byCourseBest = new Map();
  for (const exam of allExams) {
    const ms = new Date(exam.examDate).getTime();
    const existing = byCourseBest.get(exam.courseId);
    if (!existing) { byCourseBest.set(exam.courseId, exam); continue; }
    const exMs = new Date(existing.examDate).getTime();
    const isFuture   = ms   >= now;
    const exIsFuture = exMs >= now;
    if (isFuture && !exIsFuture)                       byCourseBest.set(exam.courseId, exam);
    else if (isFuture && exIsFuture && ms < exMs)      byCourseBest.set(exam.courseId, exam);
    else if (!isFuture && !exIsFuture && ms > exMs)    byCourseBest.set(exam.courseId, exam);
  }

  const upcoming = [...byCourseBest.values()]
    .sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

  wrap.innerHTML = '';
  if (upcoming.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const lang   = localStorage.getItem('app_lang') || 'zh';
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'es' ? 'es-ES' : 'en-US';

  upcoming.forEach(exam => {
    const course     = courses.find(c => c.id === exam.courseId);
    const courseName = course ? course.name : window.t('unknownCourse');
    const typeLabel  = window.t(EXAM_TYPE_KEYS_HOME[exam.type] || 'examTypeOther');
    const dateStr    = exam.examDate
      ? new Date(exam.examDate).toLocaleDateString(locale, { month: 'long', day: 'numeric' })
      : '—';

    const item = document.createElement('div');
    item.className = 'upcoming-exam-item';
    item.style.setProperty('--item-color', course ? course.color : 'var(--accent)');
    item.innerHTML = `
      <div class="upcoming-exam-course">${escHtml(courseName)}</div>
      <div class="upcoming-exam-info">
        <span class="upcoming-exam-name">${escHtml(exam.name)}</span>
        <span class="exam-type-badge ${exam.type}">${typeLabel}</span>
        <span class="upcoming-exam-date">📅 ${dateStr}</span>
        ${examDaysBadge(exam.examDate)}
      </div>
    `;
    if (course) item.addEventListener('click', () => { window.location.href = `course.html?id=${course.id}`; });
    wrap.appendChild(item);
  });
}
```

---

- [ ] **Step 2.6: Update init in `app.js`**

In `app.js`, in `initLangSwitcher()`, find:
```js
      renderExams();
```
Replace with:
```js
      renderUpcomingExams();
```

At the bottom of `app.js`, find:
```js
renderExams();
initLangSwitcher();
```
Replace with:
```js
renderUpcomingExams();
initLangSwitcher();
```

---

- [ ] **Step 2.7: Add styles for the upcoming exam widget to `styles.css`**

Append to `styles.css`:

```css
/* ── Upcoming Exam Reminders (index.html) ─────────────────────────────── */
.upcoming-exams-section { margin-top: 2rem; }

.upcoming-exams-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--muted);
}

.upcoming-exam-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem 1.1rem;
  background: var(--card);
  border-radius: 10px;
  border-left: 3px solid var(--item-color, var(--accent));
  margin-bottom: 0.6rem;
  cursor: pointer;
  transition: background 0.15s;
}
.upcoming-exam-item:hover { background: rgba(255,255,255,0.06); }

.upcoming-exam-course {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--item-color, var(--accent));
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.upcoming-exam-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-size: 0.9rem;
}

.upcoming-exam-name { font-weight: 600; color: var(--text); }
.upcoming-exam-date { color: var(--muted); font-size: 0.85rem; }
```

---

- [ ] **Step 2.8: Run test to confirm it passes**

```bash
node --test tests/p6-p8-regression.test.js
```

Expected: All tests PASS.

---

- [ ] **Step 2.9: Commit**

```bash
git add index.html app.js styles.css strings.js tests/p6-p8-regression.test.js
git commit -m "feat: redesign main page exam section as upcoming-exam reminders widget"
```

---

## Task 3: MinerU Task Persistence — Resume Polling After Navigation

**Goal:** When a MinerU material conversion is running and the user navigates away from `course.html`, the active `taskId` is persisted to localStorage. On return, polling resumes automatically so the file is saved without re-uploading.

**Scope:** Material conversion jobs only (`startMaterialMineruJob`). TOC extraction jobs are excluded because they require user interaction after completion (chapter range input). Multi-chunk PDFs (>199 pages) only persist the last active chunk's taskId — complex multi-chunk resume is out of scope.

### Files
- Modify: `course.js` (multiple sections)
- Modify: `course.html` (version bump v=32 → v=33)
- Modify: `STATUS.md`
- Modify: `tests/p6-p8-regression.test.js`

---

- [ ] **Step 3.1: Write the failing test**

Append to `tests/p6-p8-regression.test.js`:

```js
test('Task3 MinerU task IDs persisted for resume after navigation', () => {
  const src = read('course.js');

  assert.match(src, /function addPendingMinerUTask\(taskId,/);
  assert.match(src, /function removePendingMinerUTask\(taskId\)/);
  assert.match(src, /function loadPendingMinerUTasks\(\)/);
  assert.match(src, /async function resumeMinerUPoll\(taskId,/);
  assert.match(src, /resumePendingMinerUTasks\(\)/);

  // mineruSubmitAndPoll accepts onTaskIdReady callback
  assert.match(src, /async function mineruSubmitAndPoll\(fileBuffer,\s*filename,\s*fileType,\s*onStatus,\s*isCancelled,\s*onTaskIdReady\)/);
  assert.match(src, /if \(onTaskIdReady\) onTaskIdReady\(taskId\)/);

  assert.match(read('course.html'), /course\.js\?v=33/);
});
```

- [ ] **Step 3.2: Run test to confirm it fails**

```bash
node --test tests/p6-p8-regression.test.js
```

Expected: FAIL on "Task3" test.

---

- [ ] **Step 3.3: Add MinerU persistence helpers to `course.js`**

Insert after the `EXAMS_KEY` constant (around line 13), before the storage functions:

```js
const PENDING_MINERU_PREFIX = 'pendingMinerU_';
function pendingKey() { return PENDING_MINERU_PREFIX + courseId; }

function loadPendingMinerUTasks() {
  try { return JSON.parse(localStorage.getItem(pendingKey()) || '[]'); }
  catch { return []; }
}
function addPendingMinerUTask(taskId, label, mdName) {
  const tasks = loadPendingMinerUTasks();
  if (tasks.find(t => t.taskId === taskId)) return;
  tasks.push({ taskId, label, mdName, startedAt: Date.now() });
  try { localStorage.setItem(pendingKey(), JSON.stringify(tasks)); } catch {}
}
function removePendingMinerUTask(taskId) {
  const tasks = loadPendingMinerUTasks().filter(t => t.taskId !== taskId);
  try { localStorage.setItem(pendingKey(), JSON.stringify(tasks)); } catch {}
}
```

---

- [ ] **Step 3.4: Add `resumeMinerUPoll` helper**

Insert after `mineruSubmitAndPoll` (around line 876), before `uploadToTmpfiles`:

```js
async function resumeMinerUPoll(taskId, onStatus, isCancelled) {
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(r => setTimeout(r, 6000));
    if (isCancelled()) throw Object.assign(new Error('已取消'), { cancelled: true });
    const r = await fetch(`/api/mineru-result?taskId=${encodeURIComponent(taskId)}`);
    const result = await r.json();
    if (result.status === 'done') {
      if (!result.content) throw new Error('MinerU 返回内容为空');
      return result.content;
    }
    if (result.status === 'failed') throw new Error('MinerU 处理失败：' + (result.error || ''));
    const prog = result.progress ? ` ${result.progress}%` : '';
    onStatus(`恢复中：MinerU 解析中…${prog}`);
  }
  throw new Error('MinerU 处理超时');
}
```

---

- [ ] **Step 3.5: Add `onTaskIdReady` parameter to `mineruSubmitAndPoll`**

Find the function signature (around line 844):

```js
async function mineruSubmitAndPoll(fileBuffer, filename, fileType, onStatus, isCancelled) {
```

Replace with:

```js
async function mineruSubmitAndPoll(fileBuffer, filename, fileType, onStatus, isCancelled, onTaskIdReady) {
```

Then find the line `const taskId = data.taskId;` (around line 861) and add the callback call immediately after:

```js
  const taskId = data.taskId;
  if (onTaskIdReady) onTaskIdReady(taskId);
```

---

- [ ] **Step 3.6: Store `taskId` in the job map; clean up on cancel**

In `mjCreate`, the job object already has fields. We need to add `taskId: null` to it so we can reference it on cancel. Find:

```js
  mjJobs.set(id, { id, label, type, step: 1, status: '准备中…', done: false, failed: false, mdContent: null, needsRange: false, pollTimer: null });
```

Replace with:

```js
  mjJobs.set(id, { id, label, type, step: 1, status: '准备中…', done: false, failed: false, mdContent: null, needsRange: false, pollTimer: null, taskId: null });
```

In the `cancelBtn` event handler inside `mjRender()`, find:

```js
        if (j.pollTimer) clearInterval(j.pollTimer);
        if (j.type === 'toc' && currentTocJobId === j.id) {
          clearInterval(mineruPollTimer);
          mineruTaskId = null;
          mineruContent = null;
          currentTocJobId = null;
        }
        mjUpdate(j.id, { failed: true, status: '已手动终止' });
```

Add `removePendingMinerUTask` call before `mjUpdate`:

```js
        if (j.pollTimer) clearInterval(j.pollTimer);
        if (j.type === 'toc' && currentTocJobId === j.id) {
          clearInterval(mineruPollTimer);
          mineruTaskId = null;
          mineruContent = null;
          currentTocJobId = null;
        }
        if (j.taskId) removePendingMinerUTask(j.taskId);
        mjUpdate(j.id, { failed: true, status: '已手动终止' });
```

---

- [ ] **Step 3.7: Wire up persistence in `startMaterialMineruJob`**

Find `startMaterialMineruJob` (around line 1617). The goal is:
- When a single-chunk PDF or HTML task gets its taskId → call `addPendingMinerUTask`
- When done or failed → call `removePendingMinerUTask`

Find the function body. After `const jobId = mjCreate(...)` and before `const isCancelled`, add:

```js
  const mdName = baseName + '_MinerU.md';
  let _activeTaskId = null;
  const onTaskIdReady = tid => {
    _activeTaskId = tid;
    mjUpdate(jobId, { taskId: tid });
    addPendingMinerUTask(tid, baseName + ' → MD', mdName);
  };
```

Note: Remove the `const mdName = baseName + '_MinerU.md';` line that currently appears later in the function (around line 1655) since we moved it here.

Then for the `mineruSubmitAndPoll` calls inside this function, pass `onTaskIdReady` as the 6th argument for single-chunk jobs. For HTML:

```js
      combinedMarkdown = await mineruSubmitAndPoll(
        buf, file.name, 'html',
        msg => mjUpdate(jobId, { step: msg.includes('上传') ? 1 : 2, status: msg }),
        isCancelled,
        onTaskIdReady
      );
```

For PDF, pass `onTaskIdReady` only when there is exactly 1 chunk (multi-chunk is not resumable):

```js
      const markdowns = await Promise.all(chunks.map((chunk, i) => {
        const chunkName = file.name.replace(/\.pdf$/i, total > 1 ? `_p${i + 1}.pdf` : '.pdf');
        return mineruSubmitAndPoll(chunk, chunkName, 'pdf',
          msg => {
            chunkStatus[i] = msg;
            const summary = total > 1 ? chunkStatus.map((s, j) => `[${j+1}] ${s}`).join('  ') : msg;
            mjUpdate(jobId, { step: msg.includes('上传') ? 1 : 2, status: summary });
          },
          isCancelled,
          total === 1 ? onTaskIdReady : null
        );
      }));
```

At the success path, add cleanup before `mjUpdate(jobId, { done: true, ... })`:

```js
    if (_activeTaskId) removePendingMinerUTask(_activeTaskId);
    mjUpdate(jobId, { done: true, status: `✅ 已保存为 ${mdName}` });
    setTimeout(() => { mjJobs.delete(jobId); mjRender(); }, 5000);
```

In the `catch` block, add cleanup:

```js
  } catch (err) {
    if (_activeTaskId) removePendingMinerUTask(_activeTaskId);
    if (!err.cancelled) mjUpdate(jobId, { failed: true, status: '❌ ' + (err.message || '转换失败') });
  }
```

---

- [ ] **Step 3.8: Add `resumePendingMinerUTasks` and call it at init**

Insert the function before the `// ── Init ──` block at the bottom of `course.js`:

```js
async function resumePendingMinerUTasks() {
  const pending = loadPendingMinerUTasks();
  if (!pending.length) return;
  for (const task of pending) {
    if (Date.now() - task.startedAt > 12 * 60 * 1000) {
      removePendingMinerUTask(task.taskId);
      continue;
    }
    const label = task.label + ' (续)';
    const jobId = mjCreate(label, 'material');
    mjUpdate(jobId, { taskId: task.taskId });
    const isCancelled = () => { const j = mjJobs.get(jobId); return !j || j.failed; };

    resumeMinerUPoll(task.taskId, msg => mjUpdate(jobId, { step: 2, status: msg }), isCancelled)
      .then(async content => {
        mjUpdate(jobId, { step: 3, status: '正在保存…' });
        await saveMdAsMaterial(content, task.mdName);
        removePendingMinerUTask(task.taskId);
        mjUpdate(jobId, { done: true, status: `✅ 已保存为 ${task.mdName}` });
        await renderMaterials();
        setTimeout(() => { mjJobs.delete(jobId); mjRender(); }, 5000);
      })
      .catch(err => {
        if (!err.cancelled) mjUpdate(jobId, { failed: true, status: '❌ ' + (err.message || '恢复失败') });
        removePendingMinerUTask(task.taskId);
      });
  }
}
```

In the init block at the bottom of `course.js`, add:

```js
resumePendingMinerUTasks();
```

---

- [ ] **Step 3.9: Bump version in `course.html`**

Change:
```html
<script src="course.js?v=32"></script>
```
to:
```html
<script src="course.js?v=33"></script>
```

---

- [ ] **Step 3.10: Run all tests to confirm they pass**

```bash
node --test tests/p6-p8-regression.test.js
```

Expected: All tests PASS.

---

- [ ] **Step 3.11: Update `STATUS.md` and commit**

In `STATUS.md`, update version to `course.js?v=33` and mark these tasks complete.

```bash
git add course.js course.html STATUS.md tests/p6-p8-regression.test.js
git commit -m "feat: persist MinerU task IDs for resume after page navigation (v=33)"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task | Covered? |
|---|---|---|
| 返回主页再进课程后文件消失 | Task 1 (localStorage freed by IDB sessions migration) | ✅ |
| AI助手对话框无法提交/查看历史 | Task 1 (sessions in IDB survive storage overflow) | ✅ |
| 主界面考试模块改为临近考试提醒 | Task 2 | ✅ |
| 每课程最近一次考试、按时间排序 | Task 2 (`byCourseBest` map + sort) | ✅ |
| 点击跳转到对应课程 | Task 2 (`item.addEventListener('click', ...)`) | ✅ |
| PDF解析不因导航中断 | Task 3 (taskId persisted, resume on return) | ✅ |

### Placeholder scan

No TBD/TODO in code blocks. All function signatures and bodies are complete.

### Type consistency

- `dbGetSessions(cid)` / `dbSaveSessions(cid, sessions)` — consistent usage in `sessLoad`, `sessSave`, `initSessions`.
- `addPendingMinerUTask(taskId, label, mdName)` — consistent with `resumePendingMinerUTasks` which reads `.taskId`, `.label`, `.mdName`.
- `resumeMinerUPoll(taskId, onStatus, isCancelled)` — signature matches calls in `resumePendingMinerUTasks`.
- `mineruSubmitAndPoll(..., onTaskIdReady)` — 6th parameter, checked with `if (onTaskIdReady)` before calling.
