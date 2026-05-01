# Roadmap

> 本文件记录项目愿景与开发进度。由项目负责人维护。
> 最后同步：2026-05-01

---

## 项目愿景

帮助学生集中管理课程章节进度、导入教材并通过 AI 助手制定高效复习计划。
核心原则：**零构建、纯浏览器、Vercel Serverless**，保持极低的维护成本。

---

## 已完成里程碑

### M1 — 核心功能骨架 ✅
> 2026-04-28 初始提交

- [x] 课程增删改查，颜色标签，考试日期倒计时
- [x] PDF 书签自动提取章节目录
- [x] 手动添加/编辑章节
- [x] 章节完成度追踪（勾选 / 进度条）
- [x] GitHub Actions → Vercel 自动部署 CI

### M2 — AI 学习助手（第一版）✅
> 2026-04-28

- [x] Vercel Serverless Function：`api/study-plan.js`（SSE 流式输出）
- [x] 接入 Claude API（后因成本/配额切换为 Gemini）
- [x] 接入 Gemini 2.0 Flash → 2.5 Flash → 3-flash-preview 降级链
- [x] 多轮对话，支持材料保存与文本编辑
- [x] 顶层错误处理，流式错误通过 SSE 透传

### M3 — UI 视觉重设计 ✅
> 2026-04-28

- [x] Glassmorphism 卡片风格
- [x] 深色紫色 Holo / 全息彩膜美学（CSS 变量驱动）
- [x] 课程页 2 列布局，内联 AI 客户端
- [x] 全行点击触发章节勾选

### M4 — MinerU PDF 解析集成 ✅
> 2026-04-28 – 2026-04-29

- [x] `api/mineru-submit.js`：提交文件 URL，返回 taskId
- [x] `api/mineru-result.js`：轮询任务状态，提取 ZIP → Markdown
- [x] 浏览器端直传 PDF → `litterbox.catbox.moe`（72h 临时链接）
- [x] `0x0.st` 自动 fallback（litterbox 返回 504 时启用）
- [x] PDF > 199 页自动分片（`pdf-lib`），并行提交，结果顺序拼接
- [x] 可拖拽浮动任务进度组件 + 取消按钮
- [x] HTML 文件上传走 MinerU-HTML 模型
- [x] `api/generate-toc.js`：Gemini 从 Markdown 提取目录 JSON
  - 模型降级链：gemini-3-flash-preview → gemini-2.5-flash → 2.0-flash → 2.0-flash-lite
  - 自动重试 + JSON 清洗（strip fences，按括号位置切片）

### M5 — 渲染与对话质量提升 ✅
> 2026-04-28 – 2026-04-29

- [x] KaTeX auto-render：流式输出后 LaTeX 公式正确渲染
- [x] marked.js：AI 回复完整 Markdown → HTML 渲染
- [x] 多会话对话历史（`localStorage` 持久化）
- [x] Gemini 上下文窗口优化：120K/文件，300K 总量上限，超限截断提示

### M6 — 国际化 & 欢迎页 ✅
> 2026-04-28 – 2026-04-29

- [x] 三语支持（zh / en / es），~130 个字符串键
- [x] `strings.js`：`window.t(key)` / `window.tf(key, vars)`
- [x] `data-i18n` 属性驱动 HTML 静态文字
- [x] 欢迎页（`welcome.html`）：新用户语言选择，自动重定向
- [x] i18n 全量覆盖：修复遗漏的硬编码中文

### M7 — 工程规范化 ✅
> 2026-04-29

- [x] `AGENT_GUIDELINES.md`：AI Agent 行为宪法
- [x] `STATUS.md`：实时状态黑板
- [x] `ROADMAP.md`（本文件）：项目路线图
- [x] `CLAUDE.md`：会话启动自动加载指令
- [x] JS 缓存破坏版本号机制（`course.js?v=N`，当前 v=44）

---

### M8 — 课程与考试管理稳定化 ✅
> 2026-04-30

- [x] 应用改名为课程与考试管理，课程创建表单简化
- [x] 新增考试管理模块，并集成到课程页面
- [x] 主页考试区改为临近考试提醒
- [x] AI 会话历史迁移到独立 IndexedDB，避免 localStorage 配额导致资料/历史异常
- [x] MinerU 单文件资料转换任务支持返回课程页后恢复轮询
- [x] 修复返回课程页后资料/AI 功能失效：隔离 `examTrackerFiles` 与 `examTrackerChatSessions`
- [x] Markdown 教材分块检索：按章节、题号和关键词为 AI 注入相关片段
- [x] AI 回复保存为 Markdown 资料，打开资料时支持 Markdown + KaTeX 公式预览

### M9 — Demo 引导流程 ✅
> 2026-04-30

- [x] 首页自动预置"线性代数 Demo"课程
- [x] Demo 课程进入后自动启动 10 步侧边引导
- [x] 预置 6 个章节和两份 Markdown 线性代数资料（学习指南 + 原 PDF OCR 摘录）
- [x] 引导覆盖创建考试、勾选章节、选择 AI 可读资料、向 AI 提问、保存并预览 AI 回复
- [x] 支持 zh/en/es 三语文案和重置 Demo

---

## 当前能力全景（v=44）

| 模块 | 状态 |
|---|---|
| 课程管理 | ✅ |
| 章节目录（书签 / MinerU AI / 手动）| ✅ |
| 章节完成度追踪 | ✅ |
| 课程资料管理 | ✅ |
| PDF → Markdown（MinerU，含自动分片）| ✅ |
| AI 学习助手（Gemini 流式）| ✅ |
| AI 教材片段检索（Markdown）| ✅ 独立 IndexedDB 索引；支持索引版本自动重建、目录标题跳转正文、裸编号习题、低置信度题号补充摘录和文档类型 metadata |
| AI 回复保存为资料 | ✅ Markdown + KaTeX 预览 |
| AI 学习助手（DeepSeek 流式）| 🟡 代码已预置，待 API Key 验证 |
| AI 学习助手（Claude）| ⚪ UI 入口已存在，后端未接入 |
| 多会话对话历史 | ✅ 独立 IndexedDB |
| 课程页考试模块 | ✅ |
| 主页临近考试提醒 | ✅ |
| MinerU 返回课程页后续传 | ✅ 单文件资料转换 |
| LaTeX + Markdown 渲染 | ✅ |
| 三语国际化 | ✅ |
| 欢迎页 & 语言选择 | ✅ |
| 课程 Demo 引导 | ✅ v38 |
| 用户账号系统 | ⚪ 欢迎页已预留入口 |
| 移动端响应式 | ⚪ 未优化 |

---

## 当前任务

### P1 — 稳定性验证
- [ ] 验证 litterbox / 0x0.st 在 MinerU 服务器（中国）端的可访问性
- [ ] 压力测试：>500 页 PDF 分片全流程耗时基准

### P2 — Claude AI 后端接入
- [ ] 新建 `api/claude-plan.js`（参考 `study-plan.js` SSE 模式）
- [ ] 接入 Anthropic SDK，支持流式输出
- [ ] 前端 Claude 对话入口完整联通

### P3 — 移动端响应式
- [ ] `course.css` / `styles.css` 媒体查询适配小屏
- [ ] 浮动 MinerU 组件在移动端的交互优化

### P4 — 用户账号系统
- [ ] 选型：本地账号（IndexedDB）vs. 云端（Vercel + DB）
- [ ] 欢迎页"注册/登录"入口实现
- [ ] 多设备数据同步（可选）
### P5 - 中国大模型尝试
- [ ] 配置 `DEEPSEEK_API_KEY` 后验证 deepseek 的大模型 api 流式输出
- [x] 预置 DeepSeek provider 代码与前端入口
---
### P6 - 重大bug修复
- [x] AI 对话后课程数据丢失、页面功能失效（根本性修复）
  - 计划：`docs/superpowers/plans/2026-04-30-p6-bug-fix-and-p8-exam-integration.md` Task 1–3
  - 目标版本：v=30
  - 核心方案：`sendAIMsg` 分离 API 内容与对话存储；全量 localStorage 写入加 try-catch；Session 上限 5 条
- [x] AI 会话迁移至 IndexedDB（v=32/v=34）
  - 结果：会话历史存入独立 `examTrackerChatSessions`，避免 `examTrackerFiles` 资料库升级阻塞导致页面功能失效
- [x] 主界面考试模块改为临近考试提醒
  - 结果：首页只读展示每课程最近一次考试，按时间排序，点击跳转课程
- [x] MinerU 任务 ID 持久化，返回页面自动续传（v=33）
  - 结果：单文件资料转换保存 `taskId`，返回课程页后恢复轮询
### p7 - UI设计问题
- [x] 课程资料中勾选入AI助手可读范围的按键太不明显了, 干脆删去, 把AI学习助手界面的文件显示按键直接做成可交互的模式, 点开之后出现文件列表,每一行代表一个文件, 点击这行的任意位置即可添加或取消选中
- [x] 左上角的加载中不知道是干什么的
### p8 - 重要功能改动
- [x] 将现在的 ‘复习追踪器改为课程与考试管理’
- [x] 原先的prompt分为两部分: 添加课程时不再要求填入考试日期和章节总数
- [x] 将原有的考试复习安排添加成一个新的模块, 可以选择添加考试和管理考试, 其中添加考试 获取用户输入时间, 考试名称, 考试类型. 名称可以任意文本输入. 考试类型分为 开学测验, 期中测验, 期末考, 小测, 学分考和其他
- [x] 将考试复习安排集成到课程界面, 作为其的一个功能模块
  - 计划：`docs/superpowers/plans/2026-04-30-p6-bug-fix-and-p8-exam-integration.md` Task 4–6
  - 目标版本：v=31
### p9 - 设计一个课程demo
- [x] 为方便普通客户使用, 现在做一个demo, 所有的prompt都带着客户填写一遍. 当然, 不需要客户手动输入. 但是需要一步步引导客户, 从创建课程开始, 创建考试, 上传pdf文件, 以及用向ai助手提相关问题. 保存对话文件, 预览对话文件.
  - 结果：v37/v38 新增线性代数 Demo 课程、10 步侧边引导、预置章节、学习指南 Markdown、原 PDF OCR 摘录 Markdown、AI 提问按钮、保存与预览流程、重置入口和三语文案。
## 未来想法 / Backlog

- 考试日历视图（日历形式展示各课程考试日期）
- 课程间关联复习建议（跨课程 AI 分析）
- 导出学习报告（PDF / Markdown）
- PWA 离线支持
- 课程分享（只读分享链接）
- 笔记功能（章节内嵌富文本笔记）
