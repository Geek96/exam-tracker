# Session Log

> Canonical project session log. Entries are kept in reverse chronological order.

## 2026-04-30

### 21:01 EDT — AI 回复保存为 Markdown 资料并支持公式预览

**操作者**: Codex (GPT-5)

- 将 AI 回复“保存为资料”从 `.txt` 改为 `.md`，并以 `text/markdown` 存入课程资料。
- Markdown 资料打开时默认展示 Markdown + KaTeX 渲染预览，保留“编辑源码 / 预览”切换。
- 保存后的 AI 回复资料进入 Markdown 分块索引，后续可被 AI 教材检索读取。
- 更新 `course.js` 缓存版本至 `v=36`，同步 `STATUS.md` 与 `ROADMAP.md`。
- 验证：`node --test tests/*.test.js`、`node --check course.js`。

### 21:06 EDT — v36 生产部署记录

**操作者**: Codex (GPT-5)

- 推送 `main` 分支提交 `e2ff589` 到 GitHub，触发 Vercel 生产部署。
- GitHub commit status 返回 `Vercel: success`。
- 同步 `STATUS.md`：v36 已部署至 Vercel 生产环境。

**操作者**: Codex (GPT-5)

- Confirmed v35 was deployed to Vercel production after pushing `main`, then updated and saved project status files to record the production deployment state.

---

**操作者**: Codex (GPT-5)

- Implemented Markdown textbook retrieval for AI chat: added `material-rag.js` chunking/ranking helpers, persisted per-file chunks in isolated `examTrackerMaterialChunks`, loaded the helper before `course.js?v=35`, and injects relevant snippets on every free-form AI turn.
- Added regression coverage for section/exercise ranking, independent chunk storage, and repeated AI retrieval after the first turn.
- Updated `STATUS.md`, `ROADMAP.md`, `.agents/AGENT_GUIDELINES.md`, and this session log for v35.

---

**操作者**: Codex (GPT-5)

- Synchronized project status files after v34 deployment: updated `STATUS.md`, `ROADMAP.md`, `.agents/AGENT_GUIDELINES.md`, and this session log to reflect current features, completed tasks, recent commits, and IndexedDB storage architecture.

---

**操作者**: Claude Sonnet 4.6

**涉及文件**: `ROADMAP.md`, `STATUS.md`, `docs/superpowers/plans/2026-04-30-p6-storage-exam-redesign-task-resume.md`

**完成内容**:
- 读取并 commit 了用户新增的 3 条 P6 backlog 条目（ROADMAP.md）
- 深度分析 3 个新问题的根因与实现路径：
  1. **Task1（v=32）** — localStorage 溢出导致文件/历史消失：根因是 `chatSessions_*` 占用大量 localStorage 配额，修复方案为将 AI 对话 session 迁移至 IndexedDB（新建 `chatSessions` object store，IDB version 1→2），彻底释放 localStorage 空间。
  2. **Task2** — 主界面考试模块改为临近考试提醒：移除 `index.html` 考试 CRUD，替换为只读"临近考试"widget，每门课程取最近一次考试，按时间升序排列，点击跳转课程页。
  3. **Task3（v=33）** — MinerU 任务离开页面即中断：持久化 `taskId` 至 localStorage，页面返回时通过 `resumePendingMinerUTasks()` 自动续传轮询。
- 编写完整实现计划（含失败测试→实现→通过测试→commit 的 TDD 步骤），保存至 `docs/superpowers/plans/2026-04-30-p6-storage-exam-redesign-task-resume.md`。
- 更新 `STATUS.md` TASKS 板块，新增 Task1/2/3 待实现条目与版本路线。

**下一步**:
- 执行计划 Task1 → Task2 → Task3（可用 subagent-driven-development 或 executing-plans 执行）

---

**操作者**: Codex (GPT-5)

**涉及文件**: `course.js`, `course.html`, `course.css`, `app.js`, `welcome.html`, `strings.js`, `STATUS.md`, `ROADMAP.md`, `.agents/AGENT_GUIDELINES.md`, `tests/p6-p8-regression.test.js`

**完成内容**:
- 执行 P6 根本性修复：`sendAIMsg` 将展示文本与 API 上下文分离，`aiConversation` 只保存短文本，完整 Markdown 上下文仅注入当前请求的 `apiMsgs`。
- 为课程页、首页和欢迎页关键 `localStorage.setItem` 写入增加 `try/catch`，并将课程 AI 会话数量限制为 5 条，降低配额异常导致页面初始化中断的风险。
- 执行 P8 课程页考试模块集成：新增考试导航卡片、课程内考试面板、添加考试 Modal，并用共享 `examTrackerExams` 数据按 `courseId` 过滤。
- 新增 `examCount` 三语 i18n，更新 `course.js?v=31`、`STATUS.md`、`ROADMAP.md` 与 Agent 指南版本记录。
- 新增 `node --test` 回归脚本覆盖 P6/P8 关键集成点；验证 `node --test tests/p6-p8-regression.test.js`、`node --check course.js/app.js/strings.js` 通过。

---

**操作者**: Claude Sonnet 4.6

**涉及文件**: `STATUS.md`, `ROADMAP.md`, `docs/superpowers/plans/2026-04-30-p6-bug-fix-and-p8-exam-integration.md`

**完成内容**:
- 深度分析 P6 bug 根因：`aiConversation[0].content` 存储了完整 API 内容（300 KB+ Markdown 上下文），每次后续对话重复发送；`saveCourses()`/`saveFileSelection()` 缺少 try-catch，`localStorage` 超限时 `QuotaExceededError` 沿 `persist()→renderProgress()` 初始化链向上抛出，导致页面初始化中断、所有功能失效。
- 编写 P6 根本性修复 + P8 考试模块集成完整实现计划，保存至 `docs/superpowers/plans/2026-04-30-p6-bug-fix-and-p8-exam-integration.md`。
- 计划包含 7 个 Task：分离 API 内容与对话存储（v30）、全量 localStorage 写入加 try-catch、Session 上限 5 条、考试面板 HTML/CSS/JS 集成（v31）、i18n 补充、STATUS 更新。
- 更新 `STATUS.md` TASKS 板块，标注 P6（v30）和 P8（v31）为当前待实现任务。

---

**操作者**: Codex (GPT-5)

- 更新 `ROADMAP.md` 至 v29 当前状态，补充 M8 课程与考试管理重构里程碑，并同步 `STATUS.md` 当前功能与近期提交信息。
- 提交剩余项目说明文件改动：根目录 `AGENTS.md`、`CLAUDE.md` 架构规划补充、`ROADMAP.md` 路线图同步。
- 合并两份会话日志为根目录 `SESSION_LOG.md`，删除 `.agents/SESSION_LOG.md`，并将最新提交推送到 GitHub `main` 以触发 Vercel 自动部署。
- Implemented and accepted P6/P7/P8: fixed AI chat session persistence/display overflow, redesigned AI-readable file selection as a dropdown, renamed the app to 课程与考试管理, simplified course creation, and added local exam management.
- Updated `course.js` cache version to `v=29`, marked P6/P7/P8 as completed in `STATUS.md`, and renamed the implementation plan file with the `已完成-` prefix.
- 分析并诊断 P6 bug 根因：`sessPersist` 将最多 300 KB 的 Markdown 上下文写入 localStorage，在 Safari/iOS 等旧浏览器超配额时可能清空整个域名存储，导致课程数据丢失；同时 `renderSessionMessages` 在会话恢复时错误地展示了完整系统提示词而非用户输入。
- 编写 P6/P7/P8 完整实现计划，保存至 `docs/superpowers/plans/2026-04-30-p6-p7-p8-fixes-and-features.md`。
- 更新 `STATUS.md`，在 TASKS 板块添加 P6/P7/P8（新）三项待实现任务及版本路线。

## 2026-04-29

**操作者**: Codex (GPT-5)

- Implemented P6-P8 accepted features: batch PDF conversion summary toast, TOC source choice, two-step material deletion, and AI-readable Markdown file selection.
- Pre-wired DeepSeek provider code and UI, while keeping P5 open until `DEEPSEEK_API_KEY` is available for verification.
- Updated `course.js` cache version to `v=27` and synchronized `STATUS.md`, `ROADMAP.md`, and agent guidelines.

### 项目结构初始化 & i18n 完善

**操作者**: Claude Sonnet 4.6

**涉及文件**: `strings.js`, `course.js`, `course.html`, `app.js`, `.agents/`, `docs/`, `STATUS.md`, `README.md`

**完成内容**:
- 修复"添加课程"按钮双加号 bug（`btn-add-icon` + `addCourse` 字符串同时含 `+`）
- 完整翻译所有 UI 文字（~100 个字符串键）：课程资料查看/删除按钮、hero 区课程信息标签、PDF 导入弹窗全文、AI 面板全文
- 新增 `window.tf(key, vars)` 模板替换函数
- 新增 `appLocale()` 辅助函数，日期格式随语言自动切换
- 修复 MinerU 上传 `ERR_CERT_COMMON_NAME_INVALID`：从 `tmpfiles.org` 迁移到 `litterbox.catbox.moe`
- 新增首页跳转：`app_lang` 未设置的新用户自动重定向到 `welcome.html`
- 初始化项目文档目录结构（`.agents/`, `docs/`, `public/`, `src/`）

**下一步建议**:
- 验证 litterbox.catbox.moe 上传在各网络环境（含国内）的可用性
- 考虑添加上传失败后的回退服务（如 `0x0.st`）
- 探索是否需要将 `welcome.html` 注册为 Vercel 的根路由（`vercel.json` rewrites）

### 会话历史 & 欢迎页 & i18n 基础

**操作者**: Claude Sonnet 4.6

**涉及文件**: `course.html`, `course.css`, `course.js`, `index.html`, `styles.css`, `strings.js`, `welcome.html`, `welcome.css`, `api/study-plan.js`

**完成内容**:
- 多会话对话历史系统：每个课程的对话存储于 `localStorage`，支持同课程内多次独立会话
- 移除 ⚙/↺ 按钮，替换为 `🕐 历史` 侧边栏（占 AI 面板 1/3 宽度）
- 新建 `welcome.html` 欢迎页（选择语言 + 进入入口）和 `welcome.css`
- 新建 `strings.js` i18n 系统，支持中/英/西三语
- 课程列表页顶部语言切换按钮（中/EN/ES）
- `api/study-plan.js` 接收 `lang` 参数，AI 以对应语言回复

## 2026-04-28

### MinerU 大文件 & AI 上下文 & LaTeX 渲染

**操作者**: Claude Sonnet 4.6

**涉及文件**: `course.js`, `course.html`, `api/generate-toc.js`, `api/mineru-submit.js`

**完成内容**:
- PDF 超 199 页时自动分片（`splitPdfIfNeeded`），并行提交 MinerU（`Promise.all`）
- AI 上下文窗口：从 15K → 120K chars/文件，总 300K 上限
- MinerU 上传从 Vercel 代理 base64 改为浏览器直传 `tmpfiles.org`，解决 413 错误
- KaTeX auto-render：流式输出完成后调用 `renderMathInElement`，解决 LaTeX 不渲染问题
- Gemini TOC 生成：移除废弃模型，添加 `responseMimeType: 'application/json'`

### 项目初始化

**操作者**: 用户 (zhiyuan.daniel06@gmail.com)

**涉及文件**: 全部文件

**完成内容**:
- 项目初始化：课程列表页、课程详情页、AI 学习助手
- PDF 书签目录导入、手动添加章节
- Gemini 流式 AI 问答
- IndexedDB 课程资料存储
- MinerU PDF/HTML → Markdown 转换
- Vercel 部署配置
## 2026-04-30

**操作者**: Codex (GPT-5)

- Fixed navigation regression after returning to course pages: stopped forcing `examTrackerFiles` IndexedDB from v1 to v2, moved AI chat sessions into isolated `examTrackerChatSessions`, retained migration from legacy localStorage/IDB sessions, and bumped `course.js` to `v=34`.
- Task1: Migrated AI chat sessions from `localStorage` to IndexedDB `chatSessions` store and added one-time legacy session migration.
- Updated `course.js` cache version to `v=32` and added regression coverage for the IDB session storage path.
- Task2: Replaced the homepage exam CRUD section with a read-only upcoming-exam reminders widget grouped by course.
- Task3: Persisted single-file MinerU material conversion task IDs and resume polling when returning to a course page.
- Updated `course.js` cache version to `v=33` and added regression coverage for MinerU task resume hooks.
- User accepted Task1/Task2/Task3; moved them to accepted status in `STATUS.md` and renamed the implementation plan with the `已完成-` prefix.
