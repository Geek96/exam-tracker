// ── PDF.js setup ──────────────────────────────────────────────────────────────
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'examTrackerCourses';

function loadCourses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveCourses(courses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

// ── Current course ────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const courseId = params.get('id');
let courses = loadCourses();
let course = courses.find(c => c.id === courseId);

if (!course) {
  document.body.innerHTML = '<div style="padding:60px;text-align:center;color:#7B82A8">课程未找到 — <a href="index.html" style="color:#5B8DEF">返回首页</a></div>';
  throw new Error('course not found');
}

if (!course.chapters) course.chapters = [];

// ── DOM ───────────────────────────────────────────────────────────────────────
const topbarName      = document.getElementById('topbarName');
const topbarSubject   = document.getElementById('topbarSubject');
const heroMeta        = document.getElementById('heroMeta');
const heroPct         = document.getElementById('heroPct');
const heroFill        = document.getElementById('heroFill');
const heroCounts      = document.getElementById('heroCounts');
const importLanding   = document.getElementById('importLanding');
const chaptersWrap    = document.getElementById('chaptersWrap');
const chaptersList    = document.getElementById('chaptersList');
const courseHero      = document.getElementById('courseHero');

// ── Colour CSS var ────────────────────────────────────────────────────────────
document.documentElement.style.setProperty('--course-color', course.color || 'var(--accent)');
courseHero.style.borderBottom = `2px solid ${course.color}`;

// ── Render Header ─────────────────────────────────────────────────────────────
function renderHeader() {
  topbarName.textContent = course.name;
  topbarSubject.textContent = course.subject || '';

  const d = daysUntil(course.examDate);
  const dateStr = course.examDate
    ? new Date(course.examDate).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })
    : '–';

  let dClass = 'normal', dText = d !== null ? `还有 ${d} 天` : '–';
  if (d !== null) {
    if (d < 0)  { dClass = 'urgent'; dText = '已过期'; }
    if (d === 0){ dClass = 'urgent'; dText = '今天考试！'; }
    if (d <= 7) { dClass = 'urgent'; }
    else if (d <= 30) { dClass = 'soon'; }
  }

  heroMeta.innerHTML = `
    <div class="hero-meta-item">
      <span class="hero-meta-label">课程</span>
      <span class="hero-meta-value">${escHtml(course.name)}</span>
    </div>
    ${course.subject ? `
    <div class="hero-meta-item">
      <span class="hero-meta-label">科目</span>
      <span class="hero-meta-value">${escHtml(course.subject)}</span>
    </div>` : ''}
    ${course.examDate ? `
    <div class="hero-meta-item">
      <span class="hero-meta-label">考试日期</span>
      <span class="hero-meta-value">${dateStr}</span>
    </div>
    <div class="hero-meta-item">
      <span class="hero-meta-label">倒计时</span>
      <span class="hero-meta-value ${dClass}">${dText}</span>
    </div>` : ''}
  `;
}

function renderProgress() {
  let total = 0, done = 0;
  for (const ch of course.chapters) {
    for (const sec of ch.sections) {
      if (sec.subsections && sec.subsections.length > 0) {
        for (const sub of sec.subsections) { total++; if (sub.done) done++; }
      } else {
        total++; if (sec.done) done++;
      }
    }
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  heroPct.textContent = `${pct}%`;
  heroFill.style.width = `${pct}%`;
  heroFill.style.background = course.color || 'var(--accent)';
  heroCounts.textContent = total ? `已完成 ${done} / ${total} 个知识点` : '暂无章节 — 请导入或手动添加';

  course.completedTopics = done;
  course.totalTopics = total;
  course.progress = pct;
  persist();
}

// ── Render Chapters ───────────────────────────────────────────────────────────
function renderChapters() {
  // Overview: show inline import card when empty
  const importLandingInline = document.getElementById('importLandingInline');
  if (importLandingInline) {
    importLandingInline.style.display = course.chapters.length === 0 ? 'block' : 'none';
  }

  // Chapters panel state
  if (course.chapters.length === 0) {
    importLanding.style.display = 'flex';
    chaptersWrap.style.display = 'none';
  } else {
    importLanding.style.display = 'none';
    chaptersWrap.style.display = 'flex';
    chaptersList.innerHTML = '';
    course.chapters.forEach((ch, ci) => chaptersList.appendChild(buildChapterEl(ch, ci)));
  }

  updateChapterNavCard();
}

function updateChapterNavCard() {
  let totalLeaves = 0, doneLeaves = 0;
  for (const ch of course.chapters) {
    totalLeaves += countLeaves(ch);
    doneLeaves += countDoneLeaves(ch);
  }
  const pct = totalLeaves ? Math.round((doneLeaves / totalLeaves) * 100) : 0;
  const meta = document.getElementById('chapterNavMeta');
  const fill = document.getElementById('chapterNavFill');
  const pctEl = document.getElementById('chapterNavPct');
  if (meta) meta.textContent = course.chapters.length > 0
    ? `${course.chapters.length} 章 · ${totalLeaves} 个知识点`
    : '暂无章节 — 点击导入';
  if (fill) { fill.style.width = `${pct}%`; fill.style.background = course.color || 'var(--accent)'; }
  if (pctEl) pctEl.textContent = `${pct}%`;
}

function buildChapterEl(ch, ci) {
  const totalSecs = countLeaves(ch);
  const doneSecs  = countDoneLeaves(ch);
  const pct = totalSecs ? Math.round((doneSecs / totalSecs) * 100) : 0;
  const allDone = totalSecs > 0 && doneSecs === totalSecs;
  const partial  = doneSecs > 0 && !allDone;

  const el = document.createElement('div');
  el.className = 'chapter-item' + (ch.open !== false ? ' open' : '');
  el.innerHTML = `
    <div class="chapter-header">
      <span class="chapter-toggle">▶</span>
      <input type="checkbox" class="chapter-check ${partial ? 'partial' : ''}"
             ${allDone ? 'checked' : ''} data-ci="${ci}" />
      <div class="chapter-title-wrap">
        <div class="chapter-name">${escHtml(ch.title)}</div>
        <div class="chapter-sec-count">${totalSecs} 个知识点</div>
      </div>
      <div class="chapter-progress-mini">
        <div class="mini-bar"><div class="mini-fill" style="width:${pct}%;background:${course.color}"></div></div>
        <span class="mini-pct">${pct}%</span>
      </div>
    </div>
    <div class="sections-list" id="secs-${ch.id}"></div>
  `;

  const secList = el.querySelector('.sections-list');
  ch.sections.forEach((sec, si) => secList.appendChild(buildSectionEl(sec, ci, si)));

  // Toggle open/close
  el.querySelector('.chapter-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('chapter-check')) return;
    el.classList.toggle('open');
    ch.open = el.classList.contains('open');
    persist();
  });

  // Chapter checkbox — check/uncheck all sections
  el.querySelector('.chapter-check').addEventListener('change', (e) => {
    const checked = e.target.checked;
    setAllInChapter(ch, checked);
    renderChapters();
    renderProgress();
  });

  return el;
}

function buildSectionEl(sec, ci, si) {
  const hasSubs = sec.subsections && sec.subsections.length > 0;
  const allDone = hasSubs
    ? sec.subsections.every(s => s.done)
    : sec.done;
  const partial = hasSubs && sec.subsections.some(s => s.done) && !allDone;

  const row = document.createElement('div');
  row.className = 'section-row' + (allDone && !hasSubs ? ' done' : '');
  row.innerHTML = `
    <input type="checkbox" class="section-check ${partial ? 'partial' : ''}"
           ${allDone ? 'checked' : ''} data-ci="${ci}" data-si="${si}" />
    <label class="section-label">${escHtml(sec.title)}</label>
    ${hasSubs ? '<span class="chapter-toggle" style="font-size:10px">▶</span>' : ''}
  `;

  if (hasSubs) {
    const subList = document.createElement('div');
    subList.className = 'subsection-list';
    subList.style.display = 'none';
    sec.subsections.forEach((sub, bi) => {
      const subRow = document.createElement('div');
      subRow.className = 'subsection-row' + (sub.done ? ' done' : '');
      subRow.innerHTML = `
        <input type="checkbox" class="subsection-check"
               ${sub.done ? 'checked' : ''} data-ci="${ci}" data-si="${si}" data-bi="${bi}" />
        <label class="subsection-label">${escHtml(sub.title)}</label>
      `;
      subRow.querySelector('.subsection-check').addEventListener('change', (e) => {
        course.chapters[ci].sections[si].subsections[bi].done = e.target.checked;
        persist(); renderChapters(); renderProgress();
      });
      subRow.addEventListener('click', (e) => {
        if (e.target.classList.contains('subsection-check')) return;
        subRow.querySelector('.subsection-check').click();
      });
      subList.appendChild(subRow);
    });

    // Toggle subsections
    const toggle = row.querySelector('.chapter-toggle');
    toggle.style.cursor = 'pointer';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = subList.style.display === 'none';
      subList.style.display = open ? 'block' : 'none';
      toggle.style.transform = open ? 'rotate(90deg)' : '';
    });

    // Append subList right after row in parent
    row.dataset.hasSubs = '1';
    const wrapper = document.createElement('div');
    wrapper.appendChild(row);
    wrapper.appendChild(subList);

    row.querySelector('.section-check').addEventListener('change', (e) => {
      const checked = e.target.checked;
      course.chapters[ci].sections[si].subsections.forEach(s => s.done = checked);
      persist(); renderChapters(); renderProgress();
    });
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-check') || e.target.classList.contains('chapter-toggle')) return;
      row.querySelector('.section-check').click();
    });
    return wrapper;
  }

  // Simple section (no subs)
  row.querySelector('.section-check').addEventListener('change', (e) => {
    course.chapters[ci].sections[si].done = e.target.checked;
    persist(); renderChapters(); renderProgress();
  });
  row.addEventListener('click', (e) => {
    if (e.target.classList.contains('section-check')) return;
    row.querySelector('.section-check').click();
  });
  return row;
}

function setAllInChapter(ch, val) {
  ch.sections.forEach(sec => {
    sec.done = val;
    if (sec.subsections) sec.subsections.forEach(s => s.done = val);
  });
}

function countLeaves(ch) {
  let n = 0;
  for (const s of ch.sections) {
    n += (s.subsections && s.subsections.length > 0) ? s.subsections.length : 1;
  }
  return n;
}
function countDoneLeaves(ch) {
  let n = 0;
  for (const s of ch.sections) {
    if (s.subsections && s.subsections.length > 0) {
      n += s.subsections.filter(b => b.done).length;
    } else if (s.done) n++;
  }
  return n;
}

// ── Toolbar buttons ───────────────────────────────────────────────────────────
document.getElementById('btnExpandAll').addEventListener('click', () => {
  course.chapters.forEach(ch => ch.open = true);
  persist(); renderChapters();
});
document.getElementById('btnCollapseAll').addEventListener('click', () => {
  course.chapters.forEach(ch => ch.open = false);
  persist(); renderChapters();
});
document.getElementById('btnAddMore').addEventListener('click', openPdfModal);
document.getElementById('btnImportTop').addEventListener('click', openPdfModal);

// ── Panel switching: overview ↔ chapters ─────────────────────────────────────
document.getElementById('chapterNavCard').addEventListener('click', () => {
  document.getElementById('panelOverview').style.display = 'none';
  const pc = document.getElementById('panelChapters');
  pc.style.display = 'flex';
});

document.getElementById('btnChaptersBack').addEventListener('click', () => {
  document.getElementById('panelChapters').style.display = 'none';
  document.getElementById('panelOverview').style.display = 'block';
});

// ══════════════════════════════════════════════════════════════════════════════
//  PDF IMPORT MODAL
// ══════════════════════════════════════════════════════════════════════════════

let extractedOutline = null;  // raw from PDF.js or parsed text
let pdfFileName = '';
let currentPdfArrayBuffer = null;
let mineruTaskId = null;
let mineruPollTimer = null;
let mineruContent = null;
let currentTocJobId = null;

// ── MinerU Job Manager (floats at top-right) ───────────────────────────────────
let mjSeq = 0;
const mjJobs = new Map();

function mjCreate(label, type) {
  const id = 'mj' + (++mjSeq);
  mjJobs.set(id, { id, label, type, step: 1, status: '准备中…', done: false, failed: false, mdContent: null, needsRange: false, pollTimer: null });
  mjRender();
  return id;
}
function mjUpdate(id, patch) {
  const j = mjJobs.get(id);
  if (!j) return;
  Object.assign(j, patch);
  mjRender();
}
function mjRender() {
  const jobs = [...mjJobs.values()];
  const float = document.getElementById('mineruFloat');
  if (!float) return;
  if (jobs.length === 0) { float.style.display = 'none'; return; }
  float.style.display = 'flex';

  // Badge dots: show state of latest active job (or last job)
  const active = jobs.filter(j => !j.done && !j.failed);
  const latest = active.length ? active[active.length - 1] : jobs[jobs.length - 1];
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById('mfDot' + i);
    if (!dot) continue;
    const cls = ['mf-dot-mini'];
    if (i < latest.step)                               cls.push('done');
    else if (i === latest.step && latest.failed)       cls.push('fail');
    else if (i === latest.step && !latest.done)        cls.push('active');
    dot.className = cls.join(' ');
  }
  const lbl = document.getElementById('mfBadgeLabel');
  if (lbl) {
    if (active.length === 0) lbl.textContent = '任务已完成';
    else if (active.length === 1) {
      const s = latest.label.length > 14 ? latest.label.slice(0, 14) + '…' : latest.label;
      lbl.textContent = s;
    } else lbl.textContent = `${active.length} 个任务进行中`;
  }

  // Rebuild expanded job list
  const list = document.getElementById('mfJobsList');
  if (!list) return;
  list.innerHTML = '';
  ;[...jobs].reverse().forEach(j => {
    const item = document.createElement('div');
    item.className = 'mf-job-item' + (j.done ? ' j-done' : j.failed ? ' j-failed' : '');
    const stepsHtml = [1,2,3].map(i => {
      const dc = i < j.step ? 'done' : (i === j.step && j.failed ? 'fail' : (i === j.step && !j.done ? 'active' : ''));
      return `<span class="mf-dot-mini${dc ? ' ' + dc : ''}"></span>${i < 3 ? '<span class="mf-line-mini"></span>' : ''}`;
    }).join('');
    item.innerHTML = `<div class="mf-job-label">${escHtml(j.label)}</div><div class="mf-job-steps">${stepsHtml}</div><div class="mf-job-status">${escHtml(j.status)}</div>`;
    // Footer row: action buttons
    const footer = document.createElement('div');
    footer.className = 'mf-job-footer';

    if (j.needsRange) {
      const btn = document.createElement('button');
      btn.className = 'mf-job-action';
      btn.textContent = '配置目录 →';
      btn.addEventListener('click', () => {
        mfSetExpanded(false);
        openPdfModal();
        showSubstate('mineru');
        setMineruStep(3);
        setMineruStatus('✅ 解析完成！请输入章节范围描述，然后点击「生成目录结构」：');
        document.getElementById('mineruRangeSection').style.display = 'flex';
        mineruContent = j.mdContent;
        currentTocJobId = j.id;
        j.needsRange = false;
        mjRender();
      });
      footer.appendChild(btn);
    }

    if (!j.done && !j.failed) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'mf-cancel-btn';
      cancelBtn.textContent = '终止解析';
      cancelBtn.addEventListener('click', () => {
        if (j.pollTimer) clearInterval(j.pollTimer);
        if (j.type === 'toc' && currentTocJobId === j.id) {
          clearInterval(mineruPollTimer);
          mineruTaskId = null;
          mineruContent = null;
          currentTocJobId = null;
        }
        mjUpdate(j.id, { failed: true, status: '已手动终止' });
        setTimeout(() => { mjJobs.delete(j.id); mjRender(); }, 3000);
      });
      footer.appendChild(cancelBtn);
    }

    if (j.done || j.failed) {
      const db = document.createElement('button');
      db.className = 'mf-dismiss-btn';
      db.textContent = '✕ 关闭';
      db.addEventListener('click', () => { mjJobs.delete(j.id); mjRender(); });
      footer.appendChild(db);
    }

    item.appendChild(footer);
    list.appendChild(item);
  });
}

let mfExpanded = false;
function mfSetExpanded(v) {
  mfExpanded = v;
  const panel = document.getElementById('mfPanel');
  const icon  = document.getElementById('mfExpandIcon');
  if (panel) panel.style.display = mfExpanded ? 'block' : 'none';
  if (icon)  icon.textContent    = mfExpanded ? '▲' : '▼';
}
document.getElementById('mfCollapseBtn').addEventListener('click', () => mfSetExpanded(false));

// ── Draggable float widget ──────────────────────────────────────────────────
(function() {
  const el    = document.getElementById('mineruFloat');
  const badge = document.getElementById('mfBadge');
  if (!el || !badge) return;
  let dragging = false, wasDragged = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  badge.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const rect = el.getBoundingClientRect();
    el.style.right  = 'auto';
    el.style.bottom = 'auto';
    el.style.left   = rect.left + 'px';
    el.style.top    = rect.top  + 'px';
    startX = e.clientX; startY = e.clientY;
    startLeft = rect.left; startTop = rect.top;
    dragging = true; wasDragged = false;
    badge.classList.add('dragging');
    badge.setPointerCapture(e.pointerId);
  });

  badge.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) wasDragged = true;
    el.style.left = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  startLeft + dx)) + 'px';
    el.style.top  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop  + dy)) + 'px';
  });

  badge.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    badge.classList.remove('dragging');
    if (!wasDragged) mfSetExpanded(!mfExpanded);
  });
})();

// ── Open / close ──────────────────────────────────────────────────────────────
const pdfModal         = document.getElementById('pdfModal');
const pdfMineruProcess = document.getElementById('pdfMineruProcess');

function openPdfModal() {
  if (!currentTocJobId) resetStep1();
  else resetStep1UI();
  showStep(1);
  pdfModal.classList.add('open');
}
function closePdfModal() {
  pdfModal.classList.remove('open');
  if (currentTocJobId) resetStep1UI();
  else resetStep1();
}

document.getElementById('pdfModalClose1').addEventListener('click', closePdfModal);
document.getElementById('pdfModalClose2').addEventListener('click', closePdfModal);
document.getElementById('step1Cancel').addEventListener('click', closePdfModal);
pdfModal.addEventListener('click', (e) => { if (e.target === pdfModal) closePdfModal(); });

function showStep(n) {
  document.getElementById('step1').style.display = n === 1 ? 'flex' : 'none';
  document.getElementById('step2').style.display = n === 2 ? 'flex' : 'none';
}

// ── Step 1: upload zone ───────────────────────────────────────────────────────
const pdfDrop     = document.getElementById('pdfDrop');
const pdfLoading  = document.getElementById('pdfLoading');
const pdfError    = document.getElementById('pdfError');
const pdfNoOutline= document.getElementById('pdfNoOutline');
const step1Footer = document.getElementById('step1Footer');

function resetStep1UI() {
  extractedOutline = null;
  pdfFileName = '';
  document.getElementById('mineruRangeSection').style.display = 'none';
  document.getElementById('mineruRangeInput').value = '';
  document.getElementById('btnMineruGenTOC').disabled = false;
  showSubstate('drop');
  step1Footer.style.display = 'none';
  document.getElementById('tocFileName').textContent = '';
  document.getElementById('rangeStart').value = '';
  document.getElementById('rangeEnd').value   = '';
}
function resetStep1() {
  resetStep1UI();
  currentPdfArrayBuffer = null;
  clearInterval(mineruPollTimer);
  mineruTaskId = null;
  mineruContent = null;
  currentTocJobId = null;
}

function showSubstate(state) {
  pdfDrop.style.display          = state === 'drop'      ? 'flex' : 'none';
  pdfLoading.style.display       = state === 'loading'   ? 'flex' : 'none';
  pdfError.style.display         = state === 'error'     ? 'flex' : 'none';
  pdfNoOutline.style.display     = state === 'noOutline' ? 'flex' : 'none';
  pdfMineruProcess.style.display = state === 'mineru'    ? 'flex' : 'none';
}

// Drag & drop on drop zone
pdfDrop.addEventListener('dragover', (e) => { e.preventDefault(); pdfDrop.classList.add('drag-over'); });
pdfDrop.addEventListener('dragleave', () => pdfDrop.classList.remove('drag-over'));
pdfDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  pdfDrop.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handlePdfFile(file);
});

// Drag & drop on landing card (homepage panel)
const dropZoneCard = document.getElementById('dropZoneCard');
dropZoneCard.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneCard.classList.add('drag-over'); });
dropZoneCard.addEventListener('dragleave', () => dropZoneCard.classList.remove('drag-over'));
dropZoneCard.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZoneCard.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) { openPdfModal(); setTimeout(() => handlePdfFile(file), 50); }
});

// File pickers — reset value after read so the same file can be re-selected after clearing
document.getElementById('pdfFileModal').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handlePdfFile(file);
});
document.getElementById('pdfFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) { openPdfModal(); setTimeout(() => handlePdfFile(file), 50); }
});

document.getElementById('btnRetry').addEventListener('click', resetStep1);

// Parse from PDF
async function handlePdfFile(file) {
  if (!file.name.endsWith('.pdf')) {
    showError('请选择 .pdf 文件');
    return;
  }
  pdfFileName = file.name;
  showSubstate('loading');
  step1Footer.style.display = 'none';

  try {
    const buf = await file.arrayBuffer();
    currentPdfArrayBuffer = buf;  // store for MinerU path (keep original; give pdfjs a copy to transfer)
    const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
    const outline = await pdf.getOutline();

    if (!outline || outline.length === 0) {
      showSubstate('noOutline');
      return;
    }

    extractedOutline = normalizeOutline(outline);
    onOutlineReady();
  } catch (err) {
    showError('PDF 解析失败：' + err.message);
  }
}

function showError(msg) {
  document.getElementById('pdfErrorMsg').textContent = msg;
  showSubstate('error');
}

// Parse from pasted text
document.getElementById('btnParseText').addEventListener('click', () => {
  const text = document.getElementById('tocPaste').value.trim();
  if (!text) return;
  extractedOutline = parseTextTOC(text);
  if (!extractedOutline.length) { showToast('未能解析出章节，请检查格式'); return; }
  onOutlineReady();
});

// ── MinerU AI extraction flow ─────────────────────────────────────────────────
document.getElementById('btnMineruExtract').addEventListener('click', startMineruFlow);

async function startMineruFlow() {
  if (!currentPdfArrayBuffer) return;

  showSubstate('mineru');
  setMineruStep(1);
  setMineruStatus('正在分析 PDF…');
  document.getElementById('mineruRangeSection').style.display = 'none';

  const jobLabel = (pdfFileName || 'PDF').replace(/\.pdf$/i, '') + ' 目录提取';
  currentTocJobId = mjCreate(jobLabel, 'toc');
  const tocJobId = currentTocJobId;

  const isCancelled = () => {
    const j = mjJobs.get(tocJobId);
    return !j || j.failed;
  };

  try {
    const chunks = await splitPdfIfNeeded(currentPdfArrayBuffer, 199);
    const total = chunks.length;
    if (total > 1) {
      setMineruStep(2);
      setMineruStatus(`PDF 共 ${total} 部分，并行处理中…`);
      mjUpdate(tocJobId, { step: 2, status: `并行处理 ${total} 部分…` });
    }

    const chunkStatus = Array(total).fill('等待中');
    const updateStatus = () => {
      const summary = chunkStatus.map((s, i) => `[${i+1}] ${s}`).join('  ');
      mjUpdate(tocJobId, { step: 2, status: summary });
      if (pdfModal.classList.contains('open')) setMineruStatus(summary);
    };

    const markdowns = await Promise.all(chunks.map((chunk, i) => {
      const chunkName = (pdfFileName || 'upload.pdf').replace(/\.pdf$/i,
        total > 1 ? `_p${i + 1}.pdf` : '.pdf');
      return mineruSubmitAndPoll(chunk, chunkName, 'pdf',
        msg => { chunkStatus[i] = msg; if (total > 1) updateStatus(); else { setMineruStatus(msg); mjUpdate(tocJobId, { step: 2, status: msg }); } },
        isCancelled
      );
    }));

    mineruContent = markdowns.join('\n\n');
    mjUpdate(tocJobId, { step: 3, status: '✅ 解析完成，点击「配置目录 →」继续', needsRange: true, mdContent: mineruContent });
    mfSetExpanded(true);
    if (pdfModal.classList.contains('open')) {
      setMineruStep(3);
      setMineruStatus('✅ 解析完成！请输入章节范围描述，然后点击「生成目录结构」：');
      document.getElementById('mineruRangeSection').style.display = 'flex';
    }
  } catch (err) {
    if (err.cancelled) return;
    const msg = '❌ ' + err.message;
    if (pdfModal.classList.contains('open')) setMineruStatus(msg);
    mjUpdate(tocJobId, { failed: true, status: msg });
    currentTocJobId = null;
  }
}

function setMineruStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('mStep' + i);
    if (!el) continue;
    el.classList.toggle('active', i === n);
    el.classList.toggle('done', i < n);
  }
}

function setMineruStatus(text) {
  const el = document.getElementById('mineruStatusText');
  if (el) el.textContent = text;
}

document.getElementById('btnMineruGenTOC').addEventListener('click', async () => {
  if (!mineruContent) return;
  const range = document.getElementById('mineruRangeInput').value.trim();

  setMineruStatus('AI 正在生成目录结构，请稍候…');
  document.getElementById('btnMineruGenTOC').disabled = true;

  try {
    const res = await fetch('/api/generate-toc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: mineruContent.slice(0, 40000), range }),
    });
    let data;
    try { data = await res.json(); }
    catch { throw new Error(`服务器返回非JSON响应 (HTTP ${res.status})，内容可能超出大小限制`); }
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    if (!data.chapters || !data.chapters.length) throw new Error('未能提取到任何章节');

    // Map Gemini output → normalizeOutline format
    extractedOutline = data.chapters.map(ch => ({
      title: ch.title || '',
      num: extractNum(ch.title || ''),
      sections: (ch.sections || []).map(sec => ({
        title: sec.title || '',
        num: extractNum(sec.title || ''),
        subsections: (sec.subsections || []).map(sub => ({
          title: sub.title || '',
          num: extractNum(sub.title || ''),
        })),
      })),
    }));

    // Auto-save MinerU markdown as a course file
    if (mineruContent) {
      const mdName = (pdfFileName || 'document').replace(/\.pdf$/i, '') + '_MinerU.md';
      await saveMdAsMaterial(mineruContent, mdName);
    }

    if (currentTocJobId) {
      mjUpdate(currentTocJobId, { done: true, step: 3, needsRange: false, status: '✅ 目录已导入' });
      setTimeout(() => { mjJobs.delete(currentTocJobId); mjRender(); }, 4000);
      currentTocJobId = null;
    }

    // Proceed to step 2 — keep MinerU UI hidden
    showSubstate('drop');
    onOutlineReady();
  } catch (err) {
    setMineruStatus('❌ 目录生成失败：' + err.message);
    document.getElementById('btnMineruGenTOC').disabled = false;
  }
});

document.getElementById('btnMineruBack').addEventListener('click', () => {
  clearInterval(mineruPollTimer);
  mineruTaskId = null;
  mineruContent = null;
  if (currentTocJobId) {
    mjUpdate(currentTocJobId, { failed: true, status: '已取消' });
    setTimeout(() => { mjJobs.delete(currentTocJobId); mjRender(); }, 3000);
    currentTocJobId = null;
  }
  document.getElementById('mineruRangeSection').style.display = 'none';
  document.getElementById('btnMineruGenTOC').disabled = false;
  showSubstate('noOutline');
});

// Split a PDF ArrayBuffer into ≤maxPages chunks using pdf-lib.
// Returns an array of ArrayBuffers (length 1 if no split needed).
async function splitPdfIfNeeded(arrayBuffer, maxPages) {
  const { PDFDocument } = PDFLib;
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  if (total <= maxPages) return [arrayBuffer];

  const chunks = [];
  for (let start = 0; start < total; start += maxPages) {
    const end = Math.min(start + maxPages, total);
    const doc = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const pages = await doc.copyPages(srcDoc, indices);
    pages.forEach(p => doc.addPage(p));
    const bytes = await doc.save();
    chunks.push(bytes.buffer);
  }
  return chunks;
}

// Upload → MinerU submit → poll until done. Returns markdown string.
// onStatus(msg) is called with progress updates.
// isCancelled() should return true if the job was cancelled.
async function mineruSubmitAndPoll(fileBuffer, filename, fileType, onStatus, isCancelled) {
  const mimeType = fileType === 'html' ? 'text/html' : 'application/pdf';
  onStatus('正在上传…');
  const fileUrl = await uploadToTmpfiles(fileBuffer, filename, mimeType);
  if (isCancelled()) throw Object.assign(new Error('已取消'), { cancelled: true });

  onStatus('提交至 MinerU…');
  const res = await fetch('/api/mineru-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fileUrl, filename, fileType: fileType || 'pdf' }),
  });
  let data;
  try { data = await res.json(); }
  catch { throw new Error(`提交失败 (HTTP ${res.status})`); }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

  const taskId = data.taskId;
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
    onStatus(`MinerU 解析中…${prog}`);
  }
  throw new Error('MinerU 处理超时（超过 12 分钟）');
}

async function uploadToTmpfiles(arrayBuffer, filename, mimeType) {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, filename);
  const upRes = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData,
  });
  if (!upRes.ok) throw new Error(`文件上传失败：HTTP ${upRes.status}`);
  const upData = await upRes.json();
  if (upData.status !== 'success' || !upData.data?.url) throw new Error('上传服务返回异常');
  return upData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  // Process in chunks to avoid call-stack overflow on large files
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(str);
}

function onOutlineReady() {
  document.getElementById('tocFileName').textContent = pdfFileName || '手动输入';
  step1Footer.style.display = 'flex';
}

document.getElementById('step1Next').addEventListener('click', () => {
  if (!extractedOutline) return;
  renderTOCTree(extractedOutline);
  showStep(2);
});

// ── Noise filter ──────────────────────────────────────────────────────────────
const NOISE_RE = /^(cover|preface|foreword|acknowledgements?|table\s+of\s+contents?|contents?$|index$|bibliography|references?$|about\s+the\s+author|copyright|dedication|glossary|half[\s-]?title|prologue|epilogue|colophon|封面|前言|目录|致谢|索引|参考文献|版权|推荐序|序言|作者简介|书名页|附录目录|图表目录|插图目录)/i;

function isNoise(title) {
  if (!title) return true;
  const t = title.trim();
  if (/^\d/.test(t)) return false;   // numbered items are never noise
  if (/^第.+[章篇部节]/u.test(t)) return false; // Chinese chapter headings kept
  return NOISE_RE.test(t);
}

// Section-level filter: keep only items whose title starts with a decimal number (e.g. "3.1")
function isSectionNoise(title) {
  if (!title) return true;
  return !/^\d+\.\d/.test(title.trim());
}

// ── Normalize PDF.js outline → {title, num, sections:[{title,num,subsections:[]}]} ──
function normalizeOutline(raw, depth = 0) {
  if (depth > 2 || !raw) return [];
  return raw
    .filter(item => !isNoise((item.title || '').trim()))
    .map(item => ({
      title: (item.title || '').trim(),
      num: extractNum((item.title || '').trim()),
      sections: depth === 0
        ? (item.items || [])
            .filter(sec => !isSectionNoise((sec.title || '').trim()))
            .map(sec => ({
              title: (sec.title || '').trim(),
              num: extractNum((sec.title || '').trim()),
              subsections: (sec.items || [])
                .filter(sub => !isSectionNoise((sub.title || '').trim()))
                .map(sub => ({
                  title: (sub.title || '').trim(),
                  num: extractNum((sub.title || '').trim()),
                }))
            }))
        : []
    }));
}

// ── Parse pasted plain text TOC ───────────────────────────────────────────────
function parseTextTOC(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const chapters = [];
  let curChapter = null, curSection = null;

  for (const line of lines) {
    if (isNoise(line)) continue;
    const level = detectLevel(line);
    // At section/subsection level, skip anything without a decimal number prefix
    if (level >= 1 && isSectionNoise(line)) continue;
    if (level === 0) {
      curChapter = { title: line, num: extractNum(line), sections: [] };
      chapters.push(curChapter);
      curSection = null;
    } else if (level === 1) {
      if (!curChapter) {
        curChapter = { title: '其他', num: null, sections: [] };
        chapters.push(curChapter);
      }
      curSection = { title: line, num: extractNum(line), subsections: [] };
      curChapter.sections.push(curSection);
    } else {
      if (!curSection) {
        if (!curChapter) { curChapter = { title: '其他', num: null, sections: [] }; chapters.push(curChapter); }
        curSection = { title: '其他', num: null, subsections: [] };
        curChapter.sections.push(curSection);
      }
      curSection.subsections.push({ title: line, num: extractNum(line) });
    }
  }
  return chapters;
}

function detectLevel(line) {
  // Chapter-level: starts with chapter keyword or single number
  if (/^(第.+[章篇部]|chapter|part|unit)\b/i.test(line)) return 0;
  const m = line.match(/^(\d+(?:\.\d+)*)/);
  if (!m) return 0;
  const dots = (m[1].match(/\./g) || []).length;
  if (dots === 0) return 0; // e.g. "3 ..."
  if (dots === 1) return 1; // e.g. "3.1 ..."
  return 2;                 // e.g. "3.1.1 ..."
}

// ══════════════════════════════════════════════════════════════════════════════
//  Step 2 — TOC Tree + Range selection
// ══════════════════════════════════════════════════════════════════════════════

function renderTOCTree(outline) {
  const tree = document.getElementById('tocTree');
  tree.innerHTML = '';
  outline.forEach((ch, ci) => tree.appendChild(buildTOCChapter(ch, ci)));
  updateSelCount();
}

function buildTOCChapter(ch, ci) {
  const secCount = ch.sections.length;
  const el = document.createElement('div');
  el.className = 'toc-chapter open';
  el.dataset.ci = ci;

  el.innerHTML = `
    <div class="toc-ch-header">
      <span class="toc-ch-arrow">▶</span>
      <input type="checkbox" class="toc-ch-check" data-ci="${ci}" />
      <span class="toc-ch-title">${escHtml(ch.title)}</span>
      <span class="toc-ch-count">${secCount} 小节</span>
    </div>
    <div class="toc-sec-list" id="tsl-${ci}"></div>
  `;

  const secList = el.querySelector('.toc-sec-list');
  ch.sections.forEach((sec, si) => secList.appendChild(buildTOCSection(sec, ci, si)));

  // Toggle
  el.querySelector('.toc-ch-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('toc-ch-check')) return;
    el.classList.toggle('open');
  });

  // Chapter check → all sections
  const chkEl = el.querySelector('.toc-ch-check');
  chkEl.addEventListener('change', () => {
    const val = chkEl.checked;
    el.querySelectorAll('.toc-sec-check, .toc-sub-check').forEach(c => c.checked = val);
    refreshChapterCheckState(el);
    updateSelCount();
  });

  refreshChapterCheckState(el);
  return el;
}

function buildTOCSection(sec, ci, si) {
  const hasSubs = sec.subsections && sec.subsections.length > 0;
  const el = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'toc-sec-row';
  row.dataset.ci = ci;
  row.dataset.si = si;
  row.dataset.num = sec.num || '';
  row.innerHTML = `
    <input type="checkbox" class="toc-sec-check" data-ci="${ci}" data-si="${si}" checked />
    <span class="toc-sec-title">${escHtml(sec.title)}</span>
    ${hasSubs ? '<span class="toc-ch-arrow" style="font-size:10px;cursor:pointer">▶</span>' : ''}
  `;

  row.querySelector('.toc-sec-check').addEventListener('change', () => {
    if (hasSubs) {
      const val = row.querySelector('.toc-sec-check').checked;
      el.querySelectorAll('.toc-sub-check').forEach(c => c.checked = val);
    }
    const chEl = row.closest('.toc-chapter');
    refreshChapterCheckState(chEl);
    updateSelCount();
  });

  el.appendChild(row);

  if (hasSubs) {
    const subList = document.createElement('div');
    subList.className = 'toc-sub-list';
    subList.style.display = 'block';

    sec.subsections.forEach((sub, bi) => {
      const subRow = document.createElement('div');
      subRow.className = 'toc-sub-row';
      subRow.dataset.num = sub.num || '';
      subRow.innerHTML = `
        <input type="checkbox" class="toc-sub-check" data-ci="${ci}" data-si="${si}" data-bi="${bi}" checked />
        <span class="toc-sub-title">${escHtml(sub.title)}</span>
      `;
      subRow.querySelector('.toc-sub-check').addEventListener('change', () => {
        const chEl = subRow.closest('.toc-chapter');
        refreshChapterCheckState(chEl);
        updateSelCount();
      });
      subList.appendChild(subRow);
    });

    // Toggle subsections
    const arrow = row.querySelector('.toc-ch-arrow');
    if (arrow) {
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = subList.style.display !== 'none';
        subList.style.display = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(90deg)';
      });
      arrow.style.transform = 'rotate(90deg)'; // starts open
    }

    el.appendChild(subList);
  }

  return el;
}

function refreshChapterCheckState(chEl) {
  if (!chEl) return;
  const checks = [...chEl.querySelectorAll('.toc-sec-check, .toc-sub-check')];
  const allOn  = checks.every(c => c.checked);
  const anyOn  = checks.some(c => c.checked);
  const chk    = chEl.querySelector('.toc-ch-check');
  if (!chk) return;
  chk.checked = allOn;
  chk.classList.toggle('partial', !allOn && anyOn);
}

function updateSelCount() {
  const secs = [...document.querySelectorAll('.toc-sec-check')].filter(c => c.checked).length;
  const subs = [...document.querySelectorAll('.toc-sub-check')].filter(c => c.checked).length;
  const chaps = [...document.querySelectorAll('.toc-ch-check')].filter(c => {
    const chEl = c.closest('.toc-chapter');
    if (!chEl) return false;
    const checks = [...chEl.querySelectorAll('.toc-sec-check, .toc-sub-check')];
    return checks.some(x => x.checked);
  }).length;
  document.getElementById('selCount').textContent = chaps;
  document.getElementById('selSecCount').textContent = subs > 0 ? subs : secs;
}

// ── Range apply ───────────────────────────────────────────────────────────────
document.getElementById('btnApplyRange').addEventListener('click', applyRange);
document.getElementById('rangeStart').addEventListener('keydown', e => { if (e.key === 'Enter') applyRange(); });
document.getElementById('rangeEnd').addEventListener('keydown',   e => { if (e.key === 'Enter') applyRange(); });

// Compare section numbers as ordered tuples, e.g. "6.11" > "6.3" > "6.2"
function cmpSecNum(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function applyRange() {
  const startStr = document.getElementById('rangeStart').value.trim();
  const endStr   = document.getElementById('rangeEnd').value.trim();
  if (!startStr && !endStr) return;

  document.querySelectorAll('.toc-sec-row').forEach(row => {
    const num = row.dataset.num;
    if (!num) return;
    const afterStart = !startStr || cmpSecNum(num, startStr) >= 0;
    const beforeEnd  = !endStr   || cmpSecNum(num, endStr)   <= 0;
    const inRange = afterStart && beforeEnd;
    const chk = row.querySelector('.toc-sec-check');
    if (chk) chk.checked = inRange;
    row.classList.toggle('in-range', inRange);
    const subList = row.nextElementSibling;
    if (subList && subList.classList.contains('toc-sub-list')) {
      subList.querySelectorAll('.toc-sub-check').forEach(c => c.checked = inRange);
    }
  });

  document.querySelectorAll('.toc-chapter').forEach(ch => refreshChapterCheckState(ch));
  updateSelCount();
  showToast(`已选范围 ${startStr || '起始'}  至  ${endStr || '结束'}`);
}

document.getElementById('btnSelAll').addEventListener('click', () => {
  document.querySelectorAll('.toc-sec-check, .toc-sub-check').forEach(c => c.checked = true);
  document.querySelectorAll('.toc-chapter').forEach(ch => refreshChapterCheckState(ch));
  updateSelCount();
});
document.getElementById('btnSelNone').addEventListener('click', () => {
  document.querySelectorAll('.toc-sec-check, .toc-sub-check').forEach(c => c.checked = false);
  document.querySelectorAll('.toc-chapter').forEach(ch => refreshChapterCheckState(ch));
  updateSelCount();
});

// ── Step 2 back ───────────────────────────────────────────────────────────────
document.getElementById('step2Back').addEventListener('click', () => {
  showStep(1);
  step1Footer.style.display = 'flex';
  showSubstate(extractedOutline ? 'drop' : 'drop');
  // Show "file loaded" state: re-show footer only
  if (extractedOutline) showSubstate('drop');
});

// ── Confirm Import ────────────────────────────────────────────────────────────
document.getElementById('btnImportConfirm').addEventListener('click', () => {
  const imported = buildChaptersFromTree();
  if (!imported.length) { showToast('请至少选择一个章节'); return; }

  // Merge: append non-duplicate chapters
  const existingTitles = new Set(course.chapters.map(c => c.title));
  let added = 0;
  for (const ch of imported) {
    if (!existingTitles.has(ch.title)) {
      course.chapters.push(ch);
      added++;
    }
  }

  persist();
  renderChapters();
  renderProgress();
  closePdfModal();
  showToast(`已导入 ${added} 个章节 ✓`);
});

function buildChaptersFromTree() {
  const chapters = [];
  document.querySelectorAll('.toc-chapter').forEach((chEl, ci) => {
    const secChecks = [...chEl.querySelectorAll('.toc-sec-check')];
    const selectedSecs = secChecks.filter(c => c.checked);
    if (selectedSecs.length === 0) return;

    const outChapter = extractedOutline[ci];
    const ch = {
      id: uid(),
      title: outChapter.title,
      num: outChapter.num,
      open: true,
      sections: [],
    };

    selectedSecs.forEach(secChk => {
      const si = parseInt(secChk.dataset.si);
      const outSec = outChapter.sections[si];
      if (!outSec) return;

      const subChecks = [...chEl.querySelectorAll(`.toc-sub-check[data-si="${si}"]`)].filter(c => c.checked);
      const sec = {
        id: uid(),
        title: outSec.title,
        num: outSec.num,
        done: false,
        subsections: subChecks.map(subChk => {
          const bi = parseInt(subChk.dataset.bi);
          const outSub = outSec.subsections[bi];
          return { id: uid(), title: outSub ? outSub.title : '', num: outSub ? outSub.num : null, done: false };
        }),
      };
      ch.sections.push(sec);
    });

    if (ch.sections.length > 0) chapters.push(ch);
  });
  return chapters;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Manual Modal
// ══════════════════════════════════════════════════════════════════════════════
const manualModal = document.getElementById('manualModal');
document.getElementById('btnManualAdd').addEventListener('click', () => { manualModal.classList.add('open'); });
document.getElementById('manualClose').addEventListener('click', () => { manualModal.classList.remove('open'); });
document.getElementById('manualCancel').addEventListener('click', () => { manualModal.classList.remove('open'); });
manualModal.addEventListener('click', (e) => { if (e.target === manualModal) manualModal.classList.remove('open'); });

document.getElementById('manualConfirm').addEventListener('click', () => {
  const text = document.getElementById('manualText').value.trim();
  if (!text) return;
  const parsed = parseTextTOC(text);
  if (!parsed.length) { showToast('未能解析，请检查格式'); return; }

  const built = parsed.map(ch => ({
    id: uid(),
    title: ch.title,
    num: ch.num,
    open: true,
    sections: ch.sections.map(sec => ({
      id: uid(),
      title: sec.title,
      num: sec.num,
      done: false,
      subsections: (sec.subsections || []).map(sub => ({
        id: uid(), title: sub.title, num: sub.num, done: false,
      })),
    })),
  }));

  course.chapters.push(...built);
  persist(); renderChapters(); renderProgress();
  manualModal.classList.remove('open');
  document.getElementById('manualText').value = '';
  showToast(`已添加 ${built.length} 个章节 ✓`);
});

// ── Utils ─────────────────────────────────────────────────────────────────────

function extractNum(title) {
  if (!title) return null;
  const m = title.trim().match(/^(\d+(?:\.\d+)*)/);
  return m ? m[1] : null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function persist() {
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx !== -1) { courses[idx] = course; saveCourses(courses); }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Edit Course Modal
// ══════════════════════════════════════════════════════════════════════════════
const editCourseModal = document.getElementById('editCourseModal');
let editColor = course.color;

function openEditCourseModal() {
  document.getElementById('editName').value    = course.name;
  document.getElementById('editSubject').value = course.subject || '';
  document.getElementById('editDate').value    = course.examDate || '';
  editColor = course.color;
  document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === editColor);
  });
  editCourseModal.classList.add('open');
  document.getElementById('editName').focus();
}

function closeEditCourseModal() { editCourseModal.classList.remove('open'); }

document.getElementById('btnEditCourse').addEventListener('click', openEditCourseModal);
document.getElementById('editCourseClose').addEventListener('click', closeEditCourseModal);
document.getElementById('editCourseCancel').addEventListener('click', closeEditCourseModal);
editCourseModal.addEventListener('click', (e) => { if (e.target === editCourseModal) closeEditCourseModal(); });

document.getElementById('editColorPicker').addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
  swatch.classList.add('selected');
  editColor = swatch.dataset.color;
});

document.getElementById('editCourseForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('editName').value.trim();
  if (!name) return;

  course.name     = name;
  course.subject  = document.getElementById('editSubject').value.trim();
  course.examDate = document.getElementById('editDate').value;
  course.color    = editColor;

  document.documentElement.style.setProperty('--course-color', course.color);
  courseHero.style.borderBottom = `2px solid ${course.color}`;

  persist();
  renderHeader();
  renderProgress();
  closeEditCourseModal();
  showToast('课程信息已更新 ✓');
});

// ══════════════════════════════════════════════════════════════════════════════
//  Reset Chapters (two-click confirmation)
// ══════════════════════════════════════════════════════════════════════════════
let resetTimer = null;
const btnReset = document.getElementById('btnResetChapters');

btnReset.addEventListener('click', function () {
  if (this.dataset.confirm === '1') {
    clearTimeout(resetTimer);
    course.chapters = [];
    persist();
    renderChapters();
    renderProgress();
    this.textContent = '重新开始';
    this.classList.remove('danger');
    delete this.dataset.confirm;
    showToast('目录已清空，可重新导入');
  } else {
    this.dataset.confirm = '1';
    this.textContent = '确认清空？';
    this.classList.add('danger');
    resetTimer = setTimeout(() => {
      this.textContent = '重新开始';
      this.classList.remove('danger');
      delete this.dataset.confirm;
    }, 3000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Materials (IndexedDB)
// ══════════════════════════════════════════════════════════════════════════════
let _idb = null;
function getDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('examTrackerFiles', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('files', { keyPath: 'id' });
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror = () => rej(req.error);
  });
}
async function dbSave(record) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(record);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function dbGetAll() {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction('files', 'readonly').objectStore('files').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbDelete(id) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

function fileIcon(type, name) {
  const n = (name || '').toLowerCase();
  if (type === 'application/pdf' || n.endsWith('.pdf')) return '📄';
  if (type.startsWith('image/')) return '🖼';
  if (n.endsWith('.pptx') || n.endsWith('.ppt')) return '📊';
  if (n.endsWith('.docx') || n.endsWith('.doc')) return '📝';
  if (n.endsWith('.txt')) return '📃';
  if (n.endsWith('.md') || type === 'text/markdown') return '📋';
  return '📎';
}
function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

async function renderMaterials() {
  const all   = await dbGetAll();
  const files = all.filter(f => f.courseId === courseId);
  const grid  = document.getElementById('materialsGrid');
  const empty = document.getElementById('materialsEmpty');
  grid.innerHTML = '';

  if (files.length === 0) {
    empty.style.display = 'flex';
    grid.style.display = 'none';
    refreshContextBadge();
    return;
  }
  empty.style.display = 'none';
  grid.style.display = 'grid';

  files.forEach(f => {
    const isText = f.type === 'text/plain' || (f.name || '').endsWith('.md') || (f.name || '').endsWith('.txt');
    const card = document.createElement('div');
    card.className = 'material-card';
    card.innerHTML = `
      <div class="material-card-icon">${fileIcon(f.type, f.name)}</div>
      <div class="material-card-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
      <div class="material-card-meta">${fmtSize(f.size)} · ${new Date(f.addedAt).toLocaleDateString('zh-CN')}</div>
      <div class="material-card-actions">
        <button class="btn-mat-open">查看</button>
        <button class="btn-mat-rename">✎</button>
        <button class="btn-mat-del">删除</button>
      </div>`;
    card.querySelector('.btn-mat-open').addEventListener('click', e => {
      e.stopPropagation();
      if (isText) { openTextEditModal(f); return; }
      const blob = new Blob([f.data], { type: f.type });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    });
    card.querySelector('.btn-mat-rename').addEventListener('click', e => {
      e.stopPropagation();
      if (isText) { openTextEditModal(f); return; }
      openRenameModal(f);
    });
    card.querySelector('.btn-mat-del').addEventListener('click', async e => {
      e.stopPropagation();
      await dbDelete(f.id);
      await renderMaterials();
      showToast('已删除');
    });
    grid.appendChild(card);
  });

  refreshContextBadge();
}

async function uploadMaterialFiles(fileList) {
  const pdfs = [], others = [];
  for (const f of fileList) {
    if (f.name.toLowerCase().endsWith('.pdf')) pdfs.push(f);
    else others.push(f);
  }

  // Non-PDF files: save directly
  for (const file of others) {
    const data = await file.arrayBuffer();
    await dbSave({
      id: `mat_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      courseId, name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size, data, addedAt: new Date().toISOString(),
    });
  }
  if (others.length) {
    await renderMaterials();
    showToast(`已上传 ${others.length} 个文件`);
  }

  // PDFs: convert to Markdown via MinerU (background)
  for (const file of pdfs) {
    showToast(`📄 ${file.name} → 正在转换为 Markdown…`);
    startMaterialMineruJob(file, 'pdf');
  }
}

async function startMaterialMineruJob(file, fileType) {
  const isHtml = fileType === 'html';
  const ext    = isHtml ? /\.html?$/i : /\.pdf$/i;
  const baseName = file.name.replace(ext, '');
  const jobId = mjCreate(baseName + ' → MD', 'material');

  const isCancelled = () => { const j = mjJobs.get(jobId); return !j || j.failed; };

  try {
    const buf = await file.arrayBuffer();
    mjUpdate(jobId, { step: 1, status: '正在分析…' });

    let combinedMarkdown;
    if (isHtml) {
      combinedMarkdown = await mineruSubmitAndPoll(
        buf, file.name, 'html',
        msg => mjUpdate(jobId, { step: msg.includes('上传') ? 1 : 2, status: msg }),
        isCancelled
      );
    } else {
      const chunks = await splitPdfIfNeeded(buf, 199);
      const total = chunks.length;
      const chunkStatus = Array(total).fill('等待中');
      const markdowns = await Promise.all(chunks.map((chunk, i) => {
        const chunkName = file.name.replace(/\.pdf$/i, total > 1 ? `_p${i + 1}.pdf` : '.pdf');
        return mineruSubmitAndPoll(chunk, chunkName, 'pdf',
          msg => {
            chunkStatus[i] = msg;
            const summary = total > 1 ? chunkStatus.map((s, j) => `[${j+1}] ${s}`).join('  ') : msg;
            mjUpdate(jobId, { step: msg.includes('上传') ? 1 : 2, status: summary });
          },
          isCancelled
        );
      }));
      combinedMarkdown = markdowns.join('\n\n');
    }

    mjUpdate(jobId, { step: 3, status: '正在保存…' });
    const mdName = baseName + '_MinerU.md';
    await saveMdAsMaterial(combinedMarkdown, mdName);
    mjUpdate(jobId, { done: true, status: `✅ 已保存为 ${mdName}` });
    setTimeout(() => { mjJobs.delete(jobId); mjRender(); }, 5000);

  } catch (err) {
    if (err.cancelled) return;
    mjUpdate(jobId, { failed: true, status: '❌ 失败：' + err.message });
  }
}

// File input (general)
document.getElementById('materialFileInput').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (files.length) await uploadMaterialFiles(files);
});

// HTML file input → MinerU-HTML model
document.getElementById('materialHtmlInput').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  for (const file of files) {
    showToast(`⟨/⟩ ${file.name} → 正在转换为 Markdown…`);
    startMaterialMineruJob(file, 'html');
  }
});

// Drag-and-drop onto materials zone
const matDropZone = document.getElementById('materialsDropZone');
matDropZone.addEventListener('dragover', e => { e.preventDefault(); matDropZone.classList.add('drag-over'); });
matDropZone.addEventListener('dragleave', () => matDropZone.classList.remove('drag-over'));
matDropZone.addEventListener('drop', async e => {
  e.preventDefault();
  matDropZone.classList.remove('drag-over');
  const all = Array.from(e.dataTransfer.files);
  const htmlFiles = all.filter(f => /\.html?$/i.test(f.name));
  const rest      = all.filter(f => !/\.html?$/i.test(f.name));
  for (const file of htmlFiles) {
    showToast(`⟨/⟩ ${file.name} → 正在转换为 Markdown…`);
    startMaterialMineruJob(file, 'html');
  }
  if (rest.length) await uploadMaterialFiles(rest);
});

// ══════════════════════════════════════════════════════════════════════════════
//  AI Study Chat (inline right panel)
// ══════════════════════════════════════════════════════════════════════════════
const aiChatMessages = document.getElementById('aiChatMessages');
const aiChatInput    = document.getElementById('aiChatInput');
const aiDaysLeft     = document.getElementById('aiDaysLeft');
const aiHoursPerDay  = document.getElementById('aiHoursPerDay');
const aiReviewGuide  = document.getElementById('aiReviewGuide');
let aiAbortCtrl  = null;
let aiGuideContent = '';
let aiProvider   = 'gemini';
let aiConversation = [];
let aiStreaming   = false;

// Pre-fill days from exam date
(function() {
  const d = daysUntil(course.examDate);
  if (d !== null && d > 0) aiDaysLeft.value = d;
})();

// Model toggle
document.querySelectorAll('.ai-model-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-model-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    aiProvider = btn.dataset.provider;
  });
});

// ── Multi-session conversation storage ────────────────────────────────────────
function sessKey()   { return `chatSessions_${courseId}`; }
function actKey()    { return `chatActive_${courseId}`; }
function sessLoad()  { return JSON.parse(localStorage.getItem(sessKey()) || '[]'); }
function sessSave(s) { localStorage.setItem(sessKey(), JSON.stringify(s)); }
function actGet()    { return localStorage.getItem(actKey()); }
function actSet(id)  { localStorage.setItem(actKey(), id); }

function sessCreate(hint) {
  const sessions = sessLoad();
  const id = 'sess_' + Date.now();
  const title = hint ? hint.slice(0, 32) + (hint.length > 32 ? '…' : '') : '新对话';
  sessions.unshift({ id, title, createdAt: Date.now(), messages: [] });
  sessSave(sessions);
  actSet(id);
  return id;
}

function sessPersist() {
  const id = actGet(); if (!id) return;
  const sessions = sessLoad();
  const s = sessions.find(x => x.id === id); if (!s) return;
  const firstUser = aiConversation.find(m => m.role === 'user');
  if (firstUser && s.title === '新对话') {
    s.title = firstUser.content.slice(0, 32) + (firstUser.content.length > 32 ? '…' : '');
  }
  s.messages = aiConversation.slice();
  sessSave(sessions);
}

function sessSwitch(id) {
  sessPersist();
  const s = sessLoad().find(x => x.id === id); if (!s) return;
  actSet(id);
  aiConversation = s.messages.slice();
  renderSessionMessages();
  renderHistoryPanel();
}

function sessDelete(id) {
  let sessions = sessLoad().filter(x => x.id !== id);
  sessSave(sessions);
  if (actGet() === id) {
    if (sessions.length) sessSwitch(sessions[0].id);
    else { sessCreate(''); aiConversation = []; renderSessionMessages(); }
  }
  renderHistoryPanel();
}

function renderSessionMessages() {
  aiChatMessages.innerHTML = '';
  if (!aiConversation.length) {
    aiChatMessages.appendChild(buildWelcomeState());
    return;
  }
  for (const msg of aiConversation) {
    if (msg.role === 'user') {
      const el = document.createElement('div');
      el.className = 'chat-msg chat-msg-user';
      el.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHtml(msg.content)}</div>`;
      aiChatMessages.appendChild(el);
    } else {
      const el = document.createElement('div'); el.className = 'chat-msg chat-msg-assistant';
      const bubble = document.createElement('div'); bubble.className = 'chat-bubble chat-bubble-ai';
      bubble.innerHTML = mdToHtml(msg.content); renderMath(bubble);
      el.appendChild(bubble); aiChatMessages.appendChild(el);
    }
  }
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

function renderHistoryPanel() {
  const sessions = sessLoad(); const activeId = actGet();
  const list = document.getElementById('aiHistoryList'); if (!list) return;
  list.innerHTML = '';
  for (const s of sessions) {
    const item = document.createElement('div');
    item.className = 'ai-conv-item' + (s.id === activeId ? ' active' : '');
    const d = new Date(s.createdAt);
    const dateStr = d.toLocaleDateString('zh-CN', { month:'numeric', day:'numeric' });
    item.innerHTML = `<div class="ai-conv-title">${escHtml(s.title)}</div><div class="ai-conv-date">${dateStr}</div><button class="ai-conv-del" title="删除">✕</button>`;
    item.querySelector('.ai-conv-del').addEventListener('click', e => { e.stopPropagation(); sessDelete(s.id); });
    item.addEventListener('click', () => { sessSwitch(s.id); });
    list.appendChild(item);
  }
}

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

// History button toggles sidebar
document.getElementById('aiBtnHistory').addEventListener('click', () => {
  const panel = document.getElementById('aiHistoryPanel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) renderHistoryPanel();
});

// New conversation button
document.getElementById('aiNewConvBtn').addEventListener('click', () => {
  sessPersist();
  sessCreate('');
  aiConversation = [];
  renderSessionMessages();
  renderHistoryPanel();
});

// Attach button toggles guide panel
document.getElementById('aiAttachBtn').addEventListener('click', () => {
  const g = document.getElementById('aiGuidePanel');
  g.style.display = g.style.display === 'none' ? 'flex' : 'none';
});

// ── Context badge: show how many .md files are in course materials ────────────
async function refreshContextBadge() {
  try {
    const all = await dbGetAll();
    const mds = all.filter(f => f.courseId === courseId && (f.name || '').toLowerCase().endsWith('.md'));
    const badge = document.getElementById('aiContextBadge');
    const countEl = document.getElementById('aiContextCount');
    if (badge && countEl) {
      badge.style.display = mds.length > 0 ? 'flex' : 'none';
      countEl.textContent = `${mds.length} 个文件`;
    }
  } catch {}
}

// Load markdown file contents to include as AI context
async function loadMarkdownContext() {
  try {
    const all = await dbGetAll();
    const mds = all.filter(f => f.courseId === courseId && (f.name || '').toLowerCase().endsWith('.md'));
    if (!mds.length) return '';
    const fileList = mds.map(f => f.name).join('、');
    const header = `以下是课程「${escHtml(course.name)}」的课程资料文件，请在回答时优先参考相关文件内容（可用文件：${fileList}）：\n\n`;
    const PER_FILE = 120000;
    const TOTAL_CAP = 300000;
    let total = 0;
    const bodies = [];
    for (const f of mds) {
      if (total >= TOTAL_CAP) break;
      const text = new TextDecoder().decode(f.data);
      const allowed = Math.min(PER_FILE, TOTAL_CAP - total);
      const chunk = text.slice(0, allowed);
      const truncated = chunk.length < text.length;
      bodies.push(
        `--- 文件：${f.name}${truncated ? `（注意：文件较大，此处仅展示前 ${chunk.length} 字符，共 ${text.length} 字符，内容已截断）` : ''} ---\n${chunk}`
      );
      total += chunk.length;
    }
    return header + bodies.join('\n\n');
  } catch { return ''; }
}

// ── Welcome state builder ─────────────────────────────────────────────────────
function buildWelcomeState() {
  const w = document.createElement('div');
  w.className = 'ai-welcome-state';
  w.id = 'aiWelcomeState';
  w.innerHTML = `
    <div class="ai-welcome-glyph">✦</div>
    <h3 class="ai-welcome-title">AI 学习助手</h3>
    <p class="ai-welcome-sub">我可以帮你制定复习计划、解答课程疑问、分析重点内容。</p>
    <div class="ai-quick-actions" id="aiQuickActions">
      <button class="ai-quick-btn" data-prompt-type="plan">📋 生成复习计划</button>
      <button class="ai-quick-btn" data-prompt-type="summary">📖 总结课程重点</button>
      <button class="ai-quick-btn" data-prompt-type="quiz">❓ 出题测验</button>
    </div>`;
  w.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => handleQuickAction(btn.dataset.promptType));
  });
  return w;
}

async function handleQuickAction(type) {
  const daysLeft    = parseFloat(aiDaysLeft.value)    || 7;
  const hoursPerDay = parseFloat(aiHoursPerDay.value) || 3;
  const mdCtx = await loadMarkdownContext();

  let userContent, displayLabel;
  if (type === 'plan') {
    const guide = getActiveGuide();
    userContent = buildContextMsg(daysLeft, hoursPerDay, guide, mdCtx);
    displayLabel = `📋 生成复习计划 · ${daysLeft} 天 · 每天 ${hoursPerDay} 小时`;
  } else if (type === 'summary') {
    userContent = `请帮我总结课程「${escHtml(course.name)}」的核心知识点和重点内容。${mdCtx ? '\n\n课程资料：\n' + mdCtx : ''}`;
    displayLabel = '📖 总结课程重点';
  } else {
    userContent = `请根据课程「${escHtml(course.name)}」的内容为我出几道测验题，并给出答案。${mdCtx ? '\n\n课程资料：\n' + mdCtx : ''}`;
    displayLabel = '❓ 出题测验';
  }
  await sendAIMsg(userContent, displayLabel);
}

// ── AI Guide Tabs ─────────────────────────────────────────────────────────────
function getActiveTab() {
  const active = document.querySelector('#aiGuidePanel .ai-tab.active');
  return active ? active.dataset.tab : 'text';
}

function getActiveGuide() {
  const tab = getActiveTab();
  return tab === 'text' ? (aiReviewGuide ? aiReviewGuide.value.trim() : '') : aiGuideContent;
}

document.querySelectorAll('#aiTabs .ai-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#aiTabs .ai-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('aiPaneText').style.display = tab === 'text' ? 'flex' : 'none';
    document.getElementById('aiPanePdf').style.display  = tab === 'pdf'  ? 'flex' : 'none';
    document.getElementById('aiPaneUrl').style.display  = tab === 'url'  ? 'flex' : 'none';
    if (tab === 'text') aiGuideContent = '';
  });
});

// ── PDF tab: extract text ─────────────────────────────────────────────────────
function resetPdfPane() {
  document.getElementById('aiPdfZone').style.display   = 'flex';
  document.getElementById('aiPdfLoaded').style.display = 'none';
  aiGuideContent = '';
}

document.getElementById('aiPdfFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  document.getElementById('aiPdfZone').style.display   = 'none';
  document.getElementById('aiPdfLoaded').style.display = 'none';

  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const maxPages = Math.min(pdf.numPages, 40);
    for (let i = 1; i <= maxPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }
    aiGuideContent = text.trim().slice(0, 25000);

    document.getElementById('aiPdfName').textContent  = file.name;
    document.getElementById('aiPdfChars').textContent = `已提取 ${aiGuideContent.length} 字`;
    document.getElementById('aiPdfLoaded').style.display = 'flex';
  } catch (err) {
    document.getElementById('aiPdfZone').style.display = 'flex';
    showToast('PDF 提取失败：' + err.message);
  }
});

document.getElementById('aiPdfClear').addEventListener('click', resetPdfPane);

// ── URL tab: fetch content ────────────────────────────────────────────────────
function resetUrlPane() {
  document.getElementById('aiUrlLoaded').style.display = 'none';
  document.getElementById('aiUrlStatus').textContent   = '';
  aiGuideContent = '';
}

document.getElementById('aiFetchUrlBtn').addEventListener('click', async () => {
  const url    = document.getElementById('aiUrlInput').value.trim();
  const status = document.getElementById('aiUrlStatus');
  if (!url) { showToast('请输入链接'); return; }

  status.textContent = '正在获取页面内容…';
  document.getElementById('aiUrlLoaded').style.display = 'none';
  document.getElementById('aiFetchUrlBtn').disabled = true;

  try {
    const res  = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    aiGuideContent = data.text;
    status.textContent = '';
    document.getElementById('aiUrlChars').textContent = `已提取 ${aiGuideContent.length} 字`;
    document.getElementById('aiUrlLoaded').style.display = 'flex';
  } catch (err) {
    status.textContent = '获取失败：' + err.message;
    aiGuideContent = '';
  } finally {
    document.getElementById('aiFetchUrlBtn').disabled = false;
  }
});

document.getElementById('aiUrlClear').addEventListener('click', resetUrlPane);

// ── Build first-turn context message ─────────────────────────────────────────
function buildContextMsg(daysLeft, hoursPerDay, reviewGuide, mdContext) {
  const chapterText = course.chapters.map(ch => {
    const total = countLeaves(ch), done = countDoneLeaves(ch);
    const secLines = ch.sections.map(sec => {
      if (sec.subsections?.length > 0) {
        return `  - ${sec.title}\n` + sec.subsections.map(s => `    · ${s.title}${s.done ? ' ✓' : ''}`).join('\n');
      }
      return `  - ${sec.title}${sec.done ? ' ✓' : ''}`;
    }).join('\n');
    return `【${ch.title}】(${done}/${total} 已完成)\n${secLines}`;
  }).join('\n\n');

  let msg = `距考试还有 ${daysLeft} 天，每天可用 ${hoursPerDay} 小时（共约 ${daysLeft * hoursPerDay} 小时）。

课程章节及复习进度：
${chapterText || '（暂无章节）'}

复习指导：
${reviewGuide || '（未提供）'}`;

  if (mdContext) msg += `\n\n课程资料（Markdown）：\n${mdContext}`;

  msg += '\n\n请根据以上信息，生成一份按天分配的详细复习计划。';
  return msg;
}

// ── Core: send one message and stream the response ────────────────────────────
async function sendAIMsg(userContent, displayLabel) {
  if (aiStreaming) return;
  aiStreaming = true;

  // Hide welcome state on first message
  const welcome = document.getElementById('aiWelcomeState');
  if (welcome) welcome.style.display = 'none';

  aiChatInput.disabled = true;
  document.getElementById('aiChatSend').disabled = true;

  aiConversation.push({ role: 'user', content: userContent });
  sessPersist();

  const userEl = document.createElement('div');
  userEl.className = 'chat-msg chat-msg-user';
  userEl.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHtml(displayLabel || userContent)}</div>`;
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
    const res = await fetch('/api/study-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: aiAbortCtrl.signal,
      body: JSON.stringify({
        provider:   aiProvider,
        courseName: course.name,
        subject:    course.subject,
        messages:   aiConversation,
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

// ── Follow-up chat ────────────────────────────────────────────────────────────
async function doSend() {
  const text = aiChatInput.value.trim();
  if (!text || aiStreaming) return;
  aiChatInput.value = '';
  autoResizeInput();

  // For free-form messages, include md context in first turn
  let content = text;
  if (aiConversation.length === 0) {
    const mdCtx = await loadMarkdownContext();
    if (mdCtx) content = text + '\n\n[课程资料]\n' + mdCtx;
  }
  await sendAIMsg(content, text);
}
document.getElementById('aiChatSend').addEventListener('click', doSend);
aiChatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
});

// Auto-resize textarea
function autoResizeInput() {
  aiChatInput.style.height = 'auto';
  aiChatInput.style.height = Math.min(aiChatInput.scrollHeight, 120) + 'px';
}
aiChatInput.addEventListener('input', autoResizeInput);

// ── Save AI message to materials ──────────────────────────────────────────────
async function saveMsgAsMaterial(content) {
  const now  = new Date();
  const pad  = n => String(n).padStart(2, '0');
  const name = `AI对话_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
  const data = new TextEncoder().encode(content).buffer;
  await dbSave({
    id: `mat_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    courseId, name, type: 'text/plain',
    size: data.byteLength, data, addedAt: now.toISOString(),
  });
  await renderMaterials();
  showToast('已保存到课程资料 ✓');
}

// ── Text edit modal ───────────────────────────────────────────────────────────
let textEditFileId = null;
let textEditOrigFile = null;

function openTextEditModal(f) {
  textEditFileId = f.id;
  textEditOrigFile = f;
  document.getElementById('textEditTitle').textContent = f.name;
  document.getElementById('textEditRenameInput').style.display = 'none';
  document.getElementById('textEditRenameInput').value = f.name;
  const text = new TextDecoder().decode(f.data);
  document.getElementById('textEditArea').value = text;
  document.getElementById('textEditModal').classList.add('open');
}
function closeTextEditModal() {
  document.getElementById('textEditModal').classList.remove('open');
  textEditFileId = null;
  textEditOrigFile = null;
}

document.getElementById('textEditClose').addEventListener('click', closeTextEditModal);
document.getElementById('textEditCancel').addEventListener('click', closeTextEditModal);
document.getElementById('textEditModal').addEventListener('click', e => {
  if (e.target === document.getElementById('textEditModal')) closeTextEditModal();
});

document.getElementById('textEditRenameBtn').addEventListener('click', () => {
  const inp = document.getElementById('textEditRenameInput');
  inp.style.display = inp.style.display === 'none' ? 'block' : 'none';
  if (inp.style.display === 'block') inp.focus();
});

document.getElementById('textEditSave').addEventListener('click', async () => {
  if (!textEditFileId) return;
  const text = document.getElementById('textEditArea').value;
  const data = new TextEncoder().encode(text).buffer;
  const all  = await dbGetAll();
  const orig = all.find(f => f.id === textEditFileId);
  if (!orig) return;

  // Apply rename if input is visible and non-empty
  const renameInp = document.getElementById('textEditRenameInput');
  const newName = renameInp.style.display !== 'none' ? renameInp.value.trim() : '';
  const finalName = newName || orig.name;

  await dbSave({ ...orig, name: finalName, data, size: data.byteLength });
  closeTextEditModal();
  await renderMaterials();
  showToast('已保存 ✓');
});

// ── Rename modal (for non-text files) ────────────────────────────────────────
let renameFileId = null;

function openRenameModal(f) {
  renameFileId = f.id;
  document.getElementById('renameInput').value = f.name;
  document.getElementById('renameModal').classList.add('open');
  document.getElementById('renameInput').focus();
}
function closeRenameModal() {
  document.getElementById('renameModal').classList.remove('open');
  renameFileId = null;
}

document.getElementById('renameClose').addEventListener('click', closeRenameModal);
document.getElementById('renameCancel').addEventListener('click', closeRenameModal);
document.getElementById('renameModal').addEventListener('click', e => {
  if (e.target === document.getElementById('renameModal')) closeRenameModal();
});
document.getElementById('renameConfirm').addEventListener('click', async () => {
  if (!renameFileId) return;
  const newName = document.getElementById('renameInput').value.trim();
  if (!newName) return;
  const all  = await dbGetAll();
  const orig = all.find(f => f.id === renameFileId);
  if (!orig) return;
  await dbSave({ ...orig, name: newName });
  closeRenameModal();
  await renderMaterials();
  showToast('已重命名 ✓');
});
document.getElementById('renameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('renameConfirm').click();
});

// ── Save MinerU markdown as material ─────────────────────────────────────────
async function saveMdAsMaterial(mdContent, filename) {
  const name = filename || `MinerU_${Date.now()}.md`;
  const data = new TextEncoder().encode(mdContent).buffer;
  await dbSave({
    id: `mat_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    courseId, name, type: 'text/markdown',
    size: data.byteLength, data, addedAt: new Date().toISOString(),
  });
  await renderMaterials();
  showToast(`已保存 Markdown 资料：${name} ✓`);
}

const KATEX_OPTS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$',  right: '$',  display: false },
  ],
  throwOnError: false,
};

function renderMath(el) {
  if (typeof renderMathInElement === 'function') renderMathInElement(el, KATEX_OPTS);
}

function mdToHtml(md) {
  return marked.parse(md, { gfm: true });
}

// ── Layout height vars ────────────────────────────────────────────────────────
function updateLayoutHeightVars() {
  const topbar = document.querySelector('.topbar');
  const hero   = document.getElementById('courseHero');
  const th = topbar ? topbar.getBoundingClientRect().height : 48;
  const hh = hero   ? hero.getBoundingClientRect().height   : 110;
  document.documentElement.style.setProperty('--topbar-h', th + 'px');
  document.documentElement.style.setProperty('--hero-h',   hh + 'px');
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderHeader();
renderChapters();
renderProgress();
renderMaterials();
if (typeof applyStrings === 'function') applyStrings();

// Set accurate layout heights after first render
requestAnimationFrame(() => {
  updateLayoutHeightVars();
  // Re-measure after fonts settle
  setTimeout(updateLayoutHeightVars, 200);
});

if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(updateLayoutHeightVars);
  const topbar = document.querySelector('.topbar');
  const hero   = document.getElementById('courseHero');
  if (topbar) ro.observe(topbar);
  if (hero)   ro.observe(hero);
}

// Bind quick-action buttons in the static welcome state
document.querySelectorAll('#aiWelcomeState .ai-quick-btn').forEach(btn => {
  btn.addEventListener('click', () => handleQuickAction(btn.dataset.promptType));
});
