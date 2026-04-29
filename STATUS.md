# 项目状态黑板

> 📍 本文件是项目的实时状态快照。每次重要变更后更新。  
> AI Agent 在开始任务前应先读本文件，了解当前状态与已知问题。

**最后更新**: 2026-04-29  
**当前版本**: `course.js?v=21`  
**部署状态**: ✅ 生产环境正常（Vercel）

---

## 当前功能状态

| 模块 | 状态 | 备注 |
|---|---|---|
| 课程列表 & 管理 | ✅ 正常 | |
| 章节目录（PDF 书签导入）| ✅ 正常 | |
| 章节目录（MinerU AI 提取）| ✅ 正常 | 使用 litterbox.catbox.moe 上传 |
| 章节目录（手动添加）| ✅ 正常 | |
| 章节完成度追踪 | ✅ 正常 | |
| 课程资料上传 | ✅ 正常 | |
| PDF → Markdown（MinerU）| ✅ 正常 | 支持 > 199 页自动分片 |
| AI 学习助手（Gemini）| ✅ 正常 | 模型链：gemini-3-flash-preview → gemini-2.5-flash |
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

---

## 近期变更（最新 3 次提交）

```
7bd2b73  Fix i18n gaps, upload SSL error, and welcome page entry
775b122  Complete i18n coverage for all UI text across zh/en/es
e50038d  Add conversation history panel, welcome page, and i18n support
```

---

## 下一步优先级

1. **验证** litterbox.catbox.moe 在国内 MinerU 服务器端的可访问性
2. **接入** Claude API 对话（`api/claude-plan.js`）
3. **用户账号系统**（欢迎页已预留入口）
4. **移动端响应式**优化
