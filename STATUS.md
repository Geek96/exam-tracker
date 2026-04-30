# 项目状态黑板

> 📍 本文件是项目的实时状态快照。每次重要变更后更新。  
> AI Agent 在开始任务前应先读本文件，了解当前状态与已知问题。

**最后更新**: 2026-04-30  
**当前版本**: `course.js?v=34`
**部署状态**: ✅ 生产环境正常（Vercel）

---

## 当前功能状态

| 模块 | 状态 | 备注 |
|---|---|---|
| 课程列表 & 管理 | ✅ 正常 | |
| 考试管理 | ✅ 正常 | 本地考试 CRUD + 倒计时 |
| 课程页考试模块 | ✅ 正常 | 按 `courseId` 过滤，支持新增/删除课程相关考试 |
| 章节目录（PDF 书签导入）| ✅ 正常 | |
| 章节目录（MinerU AI 提取）| ✅ 正常 | 上传链：litterbox.catbox.moe → 0x0.st（自动 fallback）|
| 章节目录（手动添加）| ✅ 正常 | |
| 章节完成度追踪 | ✅ 正常 | |
| 课程资料上传 | ✅ 正常 | |
| PDF → Markdown（MinerU）| ✅ 正常 | 支持 > 199 页自动分片 |
| AI 学习助手（Gemini）| ✅ 正常 | 模型链：gemini-3-flash-preview → gemini-2.5-flash |
| AI 可读资料选择 | ✅ 正常 | 助手顶部文件下拉选择器 |
| AI 学习助手（DeepSeek）| 🟡 代码已预置 | 暂缺 API Key，待配置后验证 |
| AI 学习助手（Claude）| ⚪ 未实现 | UI 入口已存在，后端待接入 |
| 多会话对话历史 | ✅ 正常 | |
| LaTeX 渲染 | ✅ 正常 | KaTeX auto-render |
| 国际化（zh/en/es）| ✅ 正常 | ~130 个字符串键 |
| 欢迎页 & 语言选择 | ✅ 正常 | 新用户自动重定向 |

---

## 已知问题 & 待观察

| 问题 | 严重性 | 状态 |
|---|---|---|
| litterbox.catbox.moe 在国内网络下的可用性未验证 | 中 | 待测试 |
| MinerU 处理超大文件（>500 页）时总耗时较长 | 低 | 预期行为 |
| AI 对话切换语言不实时生效（需重新开始对话）| 低 | 已知限制 |
| course.js?v=N 版本号需手动递增 | 低 | 记录在 AGENT_GUIDELINES |

---

## 环境变量

| 变量 | 配置位置 | 状态 |
|---|---|---|
| `GEMINI_API_KEY` | Vercel Dashboard（Production + Preview）| ✅ 已配置 |
| `MINERU_API_KEY` | Vercel Dashboard（Production + Preview）| ✅ 已配置 |
| `DEEPSEEK_API_KEY` | Vercel Dashboard（Production + Preview）| ⬜ 待配置 |

---

## 近期变更（最新 3 次提交）

```
本次工作  feat: complete P6 root fix and P8 course exam integration
0c51292  chore: ignore local worktrees
7944f98  docs: update session log and roadmap for 2026-04-30 planning session
```

---

## TASKS:

| # | 任务 | 状态 | 目标版本 | 核心改动 |
|---|---|---|---|---|
| P5 | DeepSeek API 接入 | 🟡 代码已预置，待 API Key 验证 | — | `api/study-plan.js` + course.html model toggle |

### 已验收完成

| # | 任务 | 版本 | 结果 |
|---|---|---|---|
| P6 | 批量 PDF 转换 UX | v=24 | `uploadMaterialFiles` 合并 toast |
| P7 | TOC 来源选择 | v=25 | modal 新增 sourceChoice 子状态 |
| P8a | 资料删除二步确认 | v=26 | `renderMaterials` delete 闭包状态 |
| P8b | AI 可读文件选择 | v=27 | localStorage 选择 Set（卡片按钮已由 P7 下拉选择器替换） |
| P6 | AI 对话数据腐坏 & 系统提示词显示 | v=28 | session 历史只持久化 display/截断内容，避免 localStorage 爆配额 |
| P7 | AI 文件选择 UI 重设计 & 加载中清理 | v=29 | 顶部文件下拉选择器替代资料卡片 🤖 按钮，移除 topbar 加载中文字 |
| P8 | 应用改名 + 简化课程表单 + 考试管理模块 | — | 应用改为课程与考试管理，新增考试 CRUD |
| P6 | AI 对话后课程数据丢失（根本性修复） | v=30 | 分离 API 内容与对话存储；localStorage 写入 try-catch；Session 上限 5 |
| P8 | 考试模块集成到课程界面 | v=31 | 课程页增加考试卡片、考试面板、考试 Modal，按 courseId 过滤 |
| Task1 | AI 会话迁移至 IndexedDB | v=32 | `chatSessions_*` 从 localStorage 迁移至 IndexedDB，降低配额溢出风险 |
| Task2 | 主界面考试模块改为临近考试提醒 | — | 首页只读展示每课程最近一次考试，点击跳转课程 |
| Task3 | MinerU 任务 ID 持久化，返回页面自动续传 | v=33 | 单文件资料转换保存 `taskId`，返回课程页后恢复轮询 |

### 待配置环境变量

| 变量 | 用途 | 配置位置 |
|---|---|---|
| `DEEPSEEK_API_KEY` | P5 DeepSeek API 验证 | Vercel Dashboard（Production + Preview）|
