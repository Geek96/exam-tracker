/* demo-tour.js - guided tour for the __demo__ course */
(function () {
  var DEMO_ID = '__demo__';
  var TOTAL_STEPS = 10;
  var DEMO_MD_FILE_ID = 'demo_linear_algebra_md';
  var DEMO_MD_NAME = 'Linear_Algebra_Demo.md';

  var DEMO_MD = [
    '# Linear Algebra - Study Guide',
    '',
    '## Chapter 1: Vector Spaces',
    '',
    'A **vector space** V over a field F is a set closed under vector addition and scalar multiplication.',
    'Key axioms: commutativity, associativity, zero vector $\\mathbf{0}$, additive inverse, distributivity.',
    '',
    '**Subspace test:** W is a subspace iff W is non-empty and closed under addition and scalar multiplication.',
    '',
    '**Span:** $\\text{span}(S)=\\{a_1v_1+\\cdots+a_nv_n:a_i\\in F,v_i\\in S\\}$',
    '',
    '## Chapter 2: Linear Transformations',
    '',
    'T: V to W is linear iff $T(u+v)=T(u)+T(v)$ and $T(cv)=cT(v)$.',
    '',
    '**Rank-Nullity Theorem:** $\\dim(\\ker T)+\\dim(\\text{im}\\,T)=\\dim V$',
    '',
    '## Chapter 3: Elementary Matrix Operations',
    '',
    'Row operations: swap rows, scale a row by nonzero c, and add a multiple of one row to another.',
    '',
    '### Section 3.4 Linear Equations',
    '',
    'System $A\\mathbf{x}=\\mathbf{b}$ has a unique solution iff $\\det(A)\\neq 0$.',
    '',
    'Exercise 3. Solve $A\\mathbf{x}=\\mathbf{b}$ where $A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$, $\\mathbf{b}=\\begin{pmatrix}5\\\\6\\end{pmatrix}$.',
    '',
    'Solution: $\\det(A)=4-6=-2$. $A^{-1}=\\frac{1}{-2}\\begin{pmatrix}4&-2\\\\-3&1\\end{pmatrix}$.',
    '$\\mathbf{x}=A^{-1}\\mathbf{b}=\\begin{pmatrix}-4\\\\4.5\\end{pmatrix}$.',
    '',
    '## Chapter 4: Determinants',
    '',
    '$2\\times2$: $\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}=ad-bc$',
    '',
    'Properties: $\\det(AB)=\\det(A)\\det(B)$, $\\det(A^T)=\\det(A)$, $\\det(A^{-1})=1/\\det(A)$.',
    '',
    '## Chapter 5: Diagonalization',
    '',
    'Eigenvalue equation: $(A-\\lambda I)\\mathbf{v}=\\mathbf{0}$, so $\\det(A-\\lambda I)=0$.',
    '',
    'A is diagonalizable iff it has n linearly independent eigenvectors: $A=PDP^{-1}$.',
    '',
    'Key formulas: $A^n=PD^nP^{-1}$ and $e^A=Pe^DP^{-1}$.',
    '',
    '## Chapter 6: Inner Product Spaces',
    '',
    'Inner products satisfy conjugate symmetry, linearity, and positive definiteness.',
    '',
    '**Cauchy-Schwarz:** $|\\langle u,v\\rangle|^2\\leq\\langle u,u\\rangle\\langle v,v\\rangle$',
    '',
    '**Gram-Schmidt:** $e_k=\\frac{v_k-\\sum_{j<k}\\langle v_k,e_j\\rangle e_j}{\\|v_k-\\sum_{j<k}\\langle v_k,e_j\\rangle e_j\\|}$',
  ].join('\n');

  var cleanups = [];
  var highlighted = null;
  var stepIndex = 0;
  var questionsSent = 0;
  var panel;
  var stepCircle;
  var stepLabel;
  var progressFill;
  var titleEl;
  var descEl;
  var extraEl;
  var skipBtn;
  var nextBtn;
  var resetBtn;

  function t(key) {
    return (window.t && window.t(key)) || key;
  }

  function tf(key, vars) {
    return (window.tf && window.tf(key, vars)) || key;
  }

  function lang() {
    return localStorage.getItem('app_lang') || 'zh';
  }

  function getDemoChapters() {
    var raw = {
      zh: [
        { title: '第一章：向量空间', secs: ['1.1 向量空间的定义', '1.2 子空间'] },
        { title: '第二章：线性变换', secs: ['2.1 线性映射定义', '2.2 核与值域'] },
        { title: '第三章：初等矩阵运算', secs: ['3.4 线性方程组', '3.5 方程组解集'] },
        { title: '第四章：行列式', secs: ['4.1 行列式定义', '4.2 行列式性质'] },
        { title: '第五章：对角化', secs: ['5.1 特征值与特征向量', '5.2 可对角化条件'] },
        { title: '第六章：内积空间', secs: ['6.1 内积定义', '6.2 Gram-Schmidt 正交化'] },
      ],
      en: [
        { title: 'Chapter 1: Vector Spaces', secs: ['1.1 Definition of Vector Spaces', '1.2 Subspaces'] },
        { title: 'Chapter 2: Linear Transformations', secs: ['2.1 Linear Maps', '2.2 Kernel and Range'] },
        { title: 'Chapter 3: Elementary Matrix Operations', secs: ['3.4 Linear Equations', '3.5 Solution Sets'] },
        { title: 'Chapter 4: Determinants', secs: ['4.1 Determinant Definition', '4.2 Properties'] },
        { title: 'Chapter 5: Diagonalization', secs: ['5.1 Eigenvalues and Eigenvectors', '5.2 Diagonalizability'] },
        { title: 'Chapter 6: Inner Product Spaces', secs: ['6.1 Inner Products', '6.2 Gram-Schmidt'] },
      ],
      es: [
        { title: 'Capítulo 1: Espacios Vectoriales', secs: ['1.1 Definición', '1.2 Subespacios'] },
        { title: 'Capítulo 2: Transformaciones Lineales', secs: ['2.1 Definición', '2.2 Núcleo e Imagen'] },
        { title: 'Capítulo 3: Operaciones Matriciales', secs: ['3.4 Ecuaciones Lineales', '3.5 Conjuntos Solución'] },
        { title: 'Capítulo 4: Determinantes', secs: ['4.1 Definición', '4.2 Propiedades'] },
        { title: 'Capítulo 5: Diagonalización', secs: ['5.1 Valores Propios', '5.2 Diagonalizabilidad'] },
        { title: 'Capítulo 6: Espacios con Producto Interno', secs: ['6.1 Producto Interno', '6.2 Gram-Schmidt'] },
      ],
    };
    return (raw[lang()] || raw.zh).map(function (ch, ci) {
      return {
        id: 'demo_ch_' + ci,
        title: ch.title,
        open: true,
        sections: ch.secs.map(function (sec, si) {
          return { id: 'demo_sec_' + ci + '_' + si, title: sec, done: false };
        }),
      };
    });
  }

  function bindRefs() {
    panel = document.getElementById('demoTourPanel');
    stepCircle = document.getElementById('dtpStepCircle');
    stepLabel = document.getElementById('dtpStepLabel');
    progressFill = document.getElementById('dtpProgressFill');
    titleEl = document.getElementById('dtpTitle');
    descEl = document.getElementById('dtpDesc');
    extraEl = document.getElementById('dtpExtra');
    skipBtn = document.getElementById('dtpSkipBtn');
    nextBtn = document.getElementById('dtpNextBtn');
    resetBtn = document.getElementById('dtpResetBtn');
  }

  function getSteps() {
    return [
      { target: '#courseHero', title: t('demoWelcomeTitle'), desc: t('demoWelcomeDesc'), showNext: true },
      { target: '#btnAddExamCourse', title: t('demoAddExamTitle'), desc: t('demoAddExamDesc'), autoOn: 'examModalOpened' },
      { target: '#courseExamModalOverlay', title: t('demoConfirmExamTitle'), desc: t('demoConfirmExamDesc'), autoOn: 'examAdded' },
      { target: '#chapterNavCard', title: t('demoChaptersTitle'), desc: t('demoChaptersDesc'), showNext: true },
      { target: '#chaptersList', title: t('demoCheckChapterTitle'), desc: t('demoCheckChapterDesc'), autoOn: 'chapterChecked' },
      { target: '#panelOverview', title: t('demoMaterialsTitle'), desc: t('demoMaterialsDesc'), showNext: true },
      { target: '.panel-right', title: t('demoAITitle'), desc: t('demoAIDesc'), showNext: true },
      { target: '#aiContextBadge', title: t('demoFileSelectTitle'), desc: t('demoFileSelectDesc'), autoOn: 'fileSelected' },
      { target: '#aiChatInput', title: t('demoQuestionsTitle'), desc: t('demoQuestionsDesc'), autoOn: 'questionSent', extra: 'questions' },
      { target: '.btn-save-msg', title: t('demoSaveTitle'), desc: t('demoSaveDesc'), autoOn: 'materialSaved' },
    ];
  }

  function showLeftPanel(name) {
    var overview = document.getElementById('panelOverview');
    var chapters = document.getElementById('panelChapters');
    var exams = document.getElementById('panelExams');
    if (overview) overview.style.display = name === 'overview' ? 'block' : 'none';
    if (chapters) chapters.style.display = name === 'chapters' ? 'flex' : 'none';
    if (exams) exams.style.display = name === 'exams' ? 'flex' : 'none';
    if (name === 'chapters' && typeof renderChapters === 'function') renderChapters();
    if (name === 'exams' && typeof renderCourseExams === 'function') renderCourseExams();
  }

  function clearHighlight() {
    if (highlighted) highlighted.classList.remove('demo-tour-highlight');
    highlighted = null;
  }

  function highlight(sel) {
    clearHighlight();
    highlighted = sel ? document.querySelector(sel) : null;
    if (highlighted) highlighted.classList.add('demo-tour-highlight');
  }

  function clearAutoListeners() {
    cleanups.forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
    cleanups = [];
  }

  function advance() {
    clearAutoListeners();
    stepIndex++;
    renderStep(stepIndex);
  }

  function renderStep(idx) {
    var steps = getSteps();
    if (idx >= steps.length) {
      showCompletion();
      return;
    }
    var step = steps[idx];
    var n = idx + 1;
    if (idx === 1 || idx === 2) showLeftPanel('exams');
    if (idx === 3 || idx === 5) showLeftPanel('overview');
    if (idx === 4) showLeftPanel('chapters');
    stepCircle.textContent = n;
    stepLabel.textContent = tf('demoStepOf', { n: n });
    progressFill.style.width = Math.round((n / TOTAL_STEPS) * 100) + '%';
    titleEl.textContent = step.title;
    descEl.textContent = step.desc;
    extraEl.innerHTML = '';
    skipBtn.textContent = t('demoSkip');
    skipBtn.style.display = '';
    nextBtn.textContent = t('demoNext');
    nextBtn.style.display = step.showNext ? '' : 'none';
    resetBtn.textContent = t('demoReset');
    highlight(step.target);
    if (step.extra === 'questions') renderQuestionButtons();
    setupAutoAdvance(step);
  }

  function renderQuestionButtons() {
    questionsSent = 0;
    [t('demoQ1'), t('demoQ2'), t('demoQ3')].forEach(function (q) {
      var btn = document.createElement('button');
      btn.className = 'dtp-q-btn';
      btn.type = 'button';
      btn.textContent = q;
      btn.addEventListener('click', function () {
        if (btn.classList.contains('sent')) return;
        btn.classList.add('sent');
        var input = document.getElementById('aiChatInput');
        var send = document.getElementById('aiChatSend');
        if (input && send) {
          input.value = q;
          input.dispatchEvent(new Event('input'));
          send.click();
        }
        questionsSent++;
        if (questionsSent >= 1) nextBtn.style.display = '';
      });
      extraEl.appendChild(btn);
    });
  }

  function setupAutoAdvance(step) {
    clearAutoListeners();

    if (step.autoOn === 'examModalOpened') {
      var overlay = document.getElementById('courseExamModalOverlay');
      if (!overlay) return;
      var obs = new MutationObserver(function () {
        if (overlay.classList.contains('open')) advance();
      });
      obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
      cleanups.push(function () { obs.disconnect(); });
    }

    if (step.autoOn === 'examAdded') {
      var form = document.getElementById('courseExamForm');
      if (!form) return;
      var onSubmit = function () { setTimeout(advance, 300); };
      form.addEventListener('submit', onSubmit);
      cleanups.push(function () { form.removeEventListener('submit', onSubmit); });
    }

    if (step.autoOn === 'chapterChecked') {
      var list = document.getElementById('chaptersList');
      if (!list) return;
      var onChange = function (e) {
        if (e.target.classList.contains('chapter-check') || e.target.classList.contains('section-check')) {
          setTimeout(advance, 350);
        }
      };
      list.addEventListener('change', onChange);
      cleanups.push(function () { list.removeEventListener('change', onChange); });
    }

    if (step.autoOn === 'fileSelected') {
      var pickerList = document.getElementById('aiFilePickerList');
      if (!pickerList) return;
      var onPick = function (e) {
        if (e.target.closest('.ai-file-picker-row')) setTimeout(advance, 400);
      };
      pickerList.addEventListener('click', onPick);
      cleanups.push(function () { pickerList.removeEventListener('click', onPick); });
    }

    if (step.autoOn === 'materialSaved') {
      var msgs = document.getElementById('aiChatMessages');
      var grid = document.getElementById('materialsGrid');
      if (msgs) {
        var obs2 = new MutationObserver(function () {
          msgs.querySelectorAll('.btn-save-msg:not(.demo-wired)').forEach(function (saveBtn) {
            saveBtn.classList.add('demo-wired');
            highlight('.btn-save-msg');
            saveBtn.addEventListener('click', function () {
              setTimeout(function () { highlight('.material-card .btn-mat-open'); }, 800);
            });
          });
        });
        obs2.observe(msgs, { childList: true, subtree: true });
        cleanups.push(function () { obs2.disconnect(); });
      }
      if (grid) {
        var onPreview = function (e) {
          if (e.target.closest('.btn-mat-open')) setTimeout(showCompletion, 250);
        };
        grid.addEventListener('click', onPreview);
        cleanups.push(function () { grid.removeEventListener('click', onPreview); });
      }
    }
  }

  function showCompletion() {
    clearHighlight();
    clearAutoListeners();
    stepCircle.textContent = 'OK';
    stepLabel.textContent = '';
    progressFill.style.width = '100%';
    titleEl.textContent = t('demoDoneTitle');
    descEl.textContent = t('demoDoneDesc');
    extraEl.innerHTML = '';
    skipBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    resetBtn.textContent = t('demoReset');
    localStorage.setItem('demoTourDismissed', '1');
  }

  function dismiss() {
    clearHighlight();
    clearAutoListeners();
    panel.style.display = 'none';
    document.body.classList.remove('demo-tour-active');
    localStorage.setItem('demoTourDismissed', '1');
    showRestartBanner();
  }

  function showRestartBanner() {
    var banner = document.getElementById('demoRestartBanner');
    var restartBtn = document.getElementById('demoRestartBtn');
    if (banner && restartBtn) {
      restartBtn.textContent = t('demoRestart');
      banner.style.display = '';
    }
  }

  function startTour() {
    stepIndex = 0;
    questionsSent = 0;
    panel.style.display = 'flex';
    document.body.classList.add('demo-tour-active');
    var banner = document.getElementById('demoRestartBanner');
    if (banner) banner.style.display = 'none';
    localStorage.removeItem('demoTourDismissed');
    renderStep(0);
  }

  function wirePanelButtons() {
    skipBtn.addEventListener('click', function () {
      if (stepIndex < TOTAL_STEPS - 1) advance();
      else dismiss();
    });
    nextBtn.addEventListener('click', advance);
    resetBtn.addEventListener('click', function () {
      if (confirm(t('demoResetConfirm'))) resetDemo();
    });
    var restartBtn = document.getElementById('demoRestartBtn');
    if (restartBtn) restartBtn.addEventListener('click', startTour);
  }

  function patchExamModalOpen() {
    var addBtn = document.getElementById('btnAddExamCourse');
    if (!addBtn) return;
    addBtn.addEventListener('click', function () {
      setTimeout(function () {
        var nameInput = document.getElementById('courseExamInputName');
        var dateInput = document.getElementById('courseExamInputDate');
        var examNames = { zh: '期末考试', en: 'Final Exam', es: 'Examen Final' };
        if (nameInput && !nameInput.value) nameInput.value = examNames[lang()] || examNames.zh;
        if (dateInput && !dateInput.value) {
          var d = new Date();
          d.setDate(d.getDate() + 30);
          dateInput.value = d.toISOString().split('T')[0];
        }
        document.querySelectorAll('#courseExamTypeGroup .exam-type-btn').forEach(function (btn) {
          btn.classList.toggle('selected', btn.dataset.type === 'final');
        });
      }, 60);
    });
  }

  async function seedDemoData() {
    if (typeof course !== 'undefined' && course.chapters && course.chapters.length === 0) {
      _setCourseChapters(getDemoChapters());
    }
    try {
      var files = await dbGetAll();
      var existing = files.some(function (f) { return f.id === DEMO_MD_FILE_ID; });
      if (!existing) {
        var data = new TextEncoder().encode(DEMO_MD).buffer;
        var record = {
          id: DEMO_MD_FILE_ID,
          courseId: DEMO_ID,
          name: DEMO_MD_NAME,
          type: 'text/markdown',
          size: data.byteLength,
          data: data,
          addedAt: new Date().toISOString(),
        };
        await dbSave(record);
        await ensureChunksForMaterial(record);
      }
      await renderMaterials();
    } catch (e) {
      console.warn('[DemoTour] seedDemoData failed', e);
    }
  }

  async function resetDemo() {
    try {
      var allExams = JSON.parse(localStorage.getItem('examTrackerExams') || '[]');
      localStorage.setItem('examTrackerExams', JSON.stringify(allExams.filter(function (e) {
        return e.courseId !== DEMO_ID;
      })));
      _reloadCourseExams();
    } catch (e) {
      console.warn('[DemoTour] clear exams failed', e);
    }

    _setCourseChapters(getDemoChapters());

    try {
      await dbSaveSessions(DEMO_ID, []);
      if (typeof initSessions === 'function') await initSessions();
    } catch (e) {
      console.warn('[DemoTour] clear sessions failed', e);
    }

    try {
      var files = await dbGetAll();
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (f.courseId === DEMO_ID && f.id !== DEMO_MD_FILE_ID) {
          await dbDelete(f.id);
          await dbDeleteChunksForFile(f.id);
        }
      }
      localStorage.removeItem('aiFileSelection_' + DEMO_ID);
      await seedDemoData();
      await renderMaterials();
    } catch (e) {
      console.warn('[DemoTour] clear materials failed', e);
    }

    startTour();
  }

  async function initDemoTour() {
    bindRefs();
    if (!panel) return;
    await seedDemoData();
    patchExamModalOpen();
    wirePanelButtons();
    if (localStorage.getItem('demoTourDismissed') === '1') {
      showRestartBanner();
    } else {
      startTour();
    }
  }

  window.initDemoTour = initDemoTour;
})();
