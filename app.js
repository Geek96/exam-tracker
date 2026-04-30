// Redirect first-time visitors to the welcome/language selection page
if (!localStorage.getItem('app_lang')) {
  window.location.replace('welcome.html');
}

// ── Data Layer ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'examTrackerCourses';

const SUBJECT_EMOJI = {
  '数学': '📐', '英语': '🔤', '物理': '⚛️', '化学': '🧪',
  '生物': '🧬', '历史': '📜', '地理': '🌍', '政治': '🏛️',
  '语文': '📝', '计算机': '💻', '经济': '📊', '哲学': '🤔',
};

function getEmoji(subject) {
  if (!subject) return '📚';
  for (const [key, emoji] of Object.entries(SUBJECT_EMOJI)) {
    if (subject.includes(key)) return emoji;
  }
  return '📖';
}

function loadCourses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveCourses(courses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch (e) {
    console.warn('[ExamTracker] saveCourses failed (quota?)', e);
  }
}

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

// ── State ────────────────────────────────────────────────────────────────────

let courses = loadCourses();
let selectedColor = '#5B8DEF';

// ── DOM Refs ─────────────────────────────────────────────────────────────────

const courseGrid      = document.getElementById('courseGrid');
const emptyState      = document.getElementById('emptyState');
const modalOverlay    = document.getElementById('modalOverlay');
const courseForm      = document.getElementById('courseForm');
const btnAddCourse    = document.getElementById('btnAddCourse');
const btnCancel       = document.getElementById('btnCancel');
const modalClose      = document.getElementById('modalClose');
const colorPicker     = document.getElementById('colorPicker');
const totalCoursesLbl = document.getElementById('totalCoursesLabel');
const avgProgressLbl  = document.getElementById('avgProgressLabel');

// ── Render ────────────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  return diff;
}

function daysBadge(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return `<span class="days-badge no-date">${window.t('noDate')}</span>`;
  if (d < 0)  return `<span class="days-badge urgent">${window.t('expired')}</span>`;
  if (d === 0) return `<span class="days-badge urgent">${window.t('examToday')}</span>`;
  const label = window.tf('daysLeft', { n: d });
  if (d <= 7)  return `<span class="days-badge urgent">${label}</span>`;
  if (d <= 30) return `<span class="days-badge soon">${label}</span>`;
  return `<span class="days-badge normal">${label}</span>`;
}

function progressOf(course) {
  if (!course.totalTopics) return course.progress || 0;
  return Math.round((course.completedTopics / course.totalTopics) * 100);
}

function renderCard(course, index) {
  const pct = progressOf(course);
  const emoji = getEmoji(course.subject);
  const examFormatted = course.examDate
    ? new Date(course.examDate).toLocaleDateString('zh-CN', { month:'long', day:'numeric' })
    : '';

  const card = document.createElement('div');
  card.className = 'course-card';
  card.style.setProperty('--card-color', course.color);
  card.style.animationDelay = `${index * 60}ms`;
  card.dataset.id = course.id;

  card.innerHTML = `
    <div class="card-band"></div>
    <div class="card-body">
      <div class="card-top">
        <div class="card-icon">${emoji}</div>
        <button class="card-menu-btn" data-id="${course.id}" title="更多操作">⋯</button>
      </div>
      <div class="card-name">${escHtml(course.name)}</div>
      ${course.subject ? `<span class="card-subject">${escHtml(course.subject)}</span>` : ''}
      <div class="card-meta">
        ${examFormatted ? `<span>📅 ${examFormatted}</span>` : ''}
        ${course.totalTopics ? `<span>📋 ${window.tf('chaptersCount', { done: course.completedTopics, total: course.totalTopics })}</span>` : ''}
      </div>
      <div class="card-progress-wrap">
        <div class="card-progress-row">
          <span>${window.t('studyProgress')}</span>
          <span class="card-progress-pct">${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      ${daysBadge(course.examDate)}
    </div>
  `;

  // Click card body → course detail (placeholder)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-menu-btn')) return;
    goToCourse(course.id);
  });

  // Context menu button
  card.querySelector('.card-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showContextMenu(e, course.id);
  });

  return card;
}

function render() {
  courseGrid.innerHTML = '';

  if (courses.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    courses.forEach((c, i) => courseGrid.appendChild(renderCard(c, i)));
  }

  updateHeaderStats();
}

function updateHeaderStats() {
  totalCoursesLbl.textContent = window.tf('totalCoursesCount', { n: courses.length });
  const avg = courses.length
    ? Math.round(courses.reduce((s, c) => s + progressOf(c), 0) / courses.length)
    : 0;
  avgProgressLbl.textContent = window.tf('avgProgressText', { n: avg });
}

// ── Navigation (stub) ─────────────────────────────────────────────────────────

function goToCourse(id) {
  window.location.href = `course.html?id=${id}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal() {
  courseForm.reset();
  selectedColor = '#5B8DEF';
  colorPicker.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === selectedColor);
  });
  modalOverlay.classList.add('open');
  document.getElementById('inputName').focus();
}

function closeModal() { modalOverlay.classList.remove('open'); }

btnAddCourse.addEventListener('click', openModal);
btnCancel.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// Color swatches
colorPicker.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  swatch.classList.add('selected');
  selectedColor = swatch.dataset.color;
});

// Form submit
courseForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('inputName').value.trim();
  if (!name) return;

  const course = createCourse({
    name,
    subject: document.getElementById('inputSubject').value.trim(),
    color:   selectedColor,
  });

  courses.unshift(course);
  saveCourses(courses);
  render();
  closeModal();
  showToast(window.tf('courseAdded', { name }));
});

// ── Context Menu ──────────────────────────────────────────────────────────────

let activeCtxMenu = null;

function showContextMenu(e, courseId) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.innerHTML = `
    <button data-action="open">${window.t('openCourse')}</button>
    <button data-action="delete" class="danger">${window.t('deleteCourse')}</button>
  `;

  const rect = e.target.getBoundingClientRect();
  menu.style.top  = `${Math.min(rect.bottom + 4, window.innerHeight - 100)}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;

  menu.addEventListener('click', (ev) => {
    const action = ev.target.dataset.action;
    if (action === 'open')   goToCourse(courseId);
    if (action === 'delete') deleteCourse(courseId);
    removeContextMenu();
  });

  document.body.appendChild(menu);
  activeCtxMenu = menu;
  setTimeout(() => document.addEventListener('click', removeContextMenu, { once: true }), 0);
}

function removeContextMenu() {
  if (activeCtxMenu) { activeCtxMenu.remove(); activeCtxMenu = null; }
}

function deleteCourse(id) {
  const course = courses.find(c => c.id === id);
  courses = courses.filter(c => c.id !== id);
  saveCourses(courses);
  render();
  if (course) showToast(window.tf('courseDeleted', { name: course.name }));
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Exam Management ───────────────────────────────────────────────────────────

const EXAMS_KEY = 'examTrackerExams';

function loadExams() {
  try { return JSON.parse(localStorage.getItem(EXAMS_KEY)) || []; }
  catch { return []; }
}

function saveExams(exams) {
  try {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  } catch (e) {
    console.warn('[ExamTracker] saveExams failed (quota?)', e);
  }
}

const EXAM_TYPE_KEYS_HOME = {
  opening: 'examTypeOpening',
  midterm: 'examTypeMidterm',
  final: 'examTypeFinal',
  quiz: 'examTypeQuiz',
  credit: 'examTypeCredit',
  other: 'examTypeOther',
};

function examDaysBadge(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d < 0) return `<span class="exam-item-days urgent">${window.t('expired')}</span>`;
  if (d === 0) return `<span class="exam-item-days urgent">${window.t('examToday')}</span>`;
  const label = window.tf('daysLeft', { n: d });
  if (d <= 7) return `<span class="exam-item-days urgent">${label}</span>`;
  if (d <= 30) return `<span class="exam-item-days soon">${label}</span>`;
  return `<span class="exam-item-days">${label}</span>`;
}

function renderUpcomingExams() {
  const wrap  = document.getElementById('upcomingExamsList');
  const empty = document.getElementById('upcomingExamsEmpty');
  if (!wrap || !empty) return;

  const allExams = loadExams();
  const now = Date.now();
  const byCourseBest = new Map();

  for (const exam of allExams) {
    const ms = new Date(exam.examDate).getTime();
    const existing = byCourseBest.get(exam.courseId);
    if (!existing) { byCourseBest.set(exam.courseId, exam); continue; }
    const exMs = new Date(existing.examDate).getTime();
    const isFuture = ms >= now;
    const exIsFuture = exMs >= now;
    if (isFuture && !exIsFuture) byCourseBest.set(exam.courseId, exam);
    else if (isFuture && exIsFuture && ms < exMs) byCourseBest.set(exam.courseId, exam);
    else if (!isFuture && !exIsFuture && ms > exMs) byCourseBest.set(exam.courseId, exam);
  }

  const upcoming = [...byCourseBest.values()]
    .sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

  wrap.innerHTML = '';
  if (upcoming.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const lang = localStorage.getItem('app_lang') || 'zh';
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'es' ? 'es-ES' : 'en-US';

  upcoming.forEach(exam => {
    const course = courses.find(c => c.id === exam.courseId);
    const courseName = course ? course.name : window.t('unknownCourse');
    const typeLabel = window.t(EXAM_TYPE_KEYS_HOME[exam.type] || 'examTypeOther');
    const dateStr = exam.examDate
      ? new Date(exam.examDate).toLocaleDateString(locale, { month: 'long', day: 'numeric' })
      : '-';

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

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Language switcher ─────────────────────────────────────────────────────────

function initLangSwitcher() {
  const lang = localStorage.getItem('app_lang') || 'zh';
  document.querySelectorAll('.lang-sw-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
    btn.addEventListener('click', () => {
      try {
        localStorage.setItem('app_lang', btn.dataset.lang);
      } catch (e) {
        console.warn('[ExamTracker] save language failed (quota?)', e);
      }
      document.querySelectorAll('.lang-sw-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === btn.dataset.lang));
      if (typeof applyStrings === 'function') applyStrings();
      render();
      renderUpcomingExams();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

render();
if (typeof applyStrings === 'function') applyStrings();
renderUpcomingExams();
initLangSwitcher();
