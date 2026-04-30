# 项目状态黑板

> 📍 本文件是项目的实时状态快照。每次重要变更后更新。  
> AI Agent 在开始任务前应先读本文件，了解当前状态与已知问题。

**最后更新**: 2026-04-29  
**当前版本**: `course.js?v=27`
**部署状态**: ✅ 生产环境正常（Vercel）

---

## 当前功能状态

| 模块 | 状态 | 备注 |
|---|---|---|
| 课程列表 & 管理 | ✅ 正常 | |
| 章节目录（PDF 书签导入）| ✅ 正常 | |
| 章节目录（MinerU AI 提取）| ✅ 正常 | 上传链：litterbox.catbox.moe → 0x0.st（自动 fallback）|
| 章节目录（手动添加）| ✅ 正常 | |
| 章节完成度追踪 | ✅ 正常 | |
| 课程资料上传 | ✅ 正常 | |
| PDF → Markdown（MinerU）| ✅ 正常 | 支持 > 199 页自动分片 |
| AI 学习助手（Gemini）| ✅ 正常 | 模型链：gemini-3-flash-preview → gemini-2.5-flash |
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
a3fc715  docs: require agents to read STATUS.md and ROADMAP.md at session start
ad0c088  fix: add 0x0.st fallback for PDF upload (litterbox 504 timeout)
7bd2b73  Fix i18n gaps, upload SSL error, and welcome page entry
```

---

## TASKS:

> 计划文件：`docs/superpowers/plans/2026-04-29-p5-p8-features.md`
> 版本路线：v22 → v23（P5）→ v24（P6）→ v25（P7）→ v26（P8a）→ v27（P8b）

| # | 任务 | 状态 | 目标版本 | 核心改动 |
|---|---|---|---|---|
| P5 | DeepSeek API 接入 | 🟡 代码已预置，待 API Key 验证 | v=23 | `api/study-plan.js` + course.html model toggle |

### 已验收完成

| # | 任务 | 版本 | 结果 |
|---|---|---|---|
| P6 | 批量 PDF 转换 UX | v=24 | `uploadMaterialFiles` 合并 toast |
| P7 | TOC 来源选择 | v=25 | modal 新增 sourceChoice 子状态 |
| P8a | 资料删除二步确认 | v=26 | `renderMaterials` delete 闭包状态 |
| P8b | AI 可读文件选择 | v=27 | localStorage 选择 Set + 卡片 🤖 按钮 |

### 待配置环境变量

| 变量 | 用途 | 配置位置 |
|---|---|---|
| `DEEPSEEK_API_KEY` | P5 DeepSeek API 验证 | Vercel Dashboard（Production + Preview）|
